// ═══════════════════════════════════════════════════════════════════════════
// Daily admin digest — runs once per day via Vercel Cron
// ═══════════════════════════════════════════════════════════════════════════
//
// Sends ONE summary email per day to the admin containing:
//   • Group A: New user profiles created in the last 24h (with any clubs they made)
//   • Group B: New clubs added by EXISTING profiles (older than 24h) in the last 24h
//
// REQUIRED ENV VARS (set in Vercel → Project → Settings → Environment Variables):
//   BREVO_API_KEY              — your Brevo (Sendinblue) v3 API key
//   ADMIN_NOTIFICATION_EMAIL   — recipient address (e.g. you@gmail.com)
//   BREVO_SENDER_EMAIL         — verified sender (e.g. notifications@myclublocator.com)
//   BREVO_SENDER_NAME          — friendly from-name (default: "MyClubLocator")
//   SUPABASE_URL               — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  — service-role key (NEVER expose to client)
//   CRON_SECRET                — random string; Vercel Cron sends it as Authorization header
//
// SCHEDULE: Configured in vercel.json — runs daily at 13:00 UTC (≈ 8am Cincinnati / 9am EDT)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // ── Auth: only Vercel Cron (or manual call with secret) can trigger ──
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Validate required env vars ──
  const required = ['BREVO_API_KEY', 'ADMIN_NOTIFICATION_EMAIL', 'BREVO_SENDER_EMAIL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // ── Window: last 24 hours ──
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // ── 1. Fetch new auth users from the last 24h ──
    // Supabase admin API returns paginated user list; 1000 per page is plenty for daily volume
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersErr) throw new Error(`auth.admin.listUsers failed: ${usersErr.message}`)

    const newUsers = (usersData?.users || []).filter(u => u.created_at && u.created_at >= since)
    const newUserIds = new Set(newUsers.map(u => u.id))

    // ── 2. Fetch all locations created in the last 24h ──
    const { data: newClubs, error: clubsErr } = await supabase
      .from('locations')
      .select('id, user_id, club_name, first_name, last_name, club_email, city, state, address, zip, created_at, status, approved')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (clubsErr) throw new Error(`locations query failed: ${clubsErr.message}`)

    const allClubs = newClubs || []

    // ── 3. Split clubs into "from new user" vs "from existing user" ──
    const clubsByNewUser = new Map() // user_id -> [club, club, ...]
    const clubsByExistingUser = new Map() // user_id -> [club, club, ...]

    for (const club of allClubs) {
      if (!club.user_id) continue // skip orphans
      const bucket = newUserIds.has(club.user_id) ? clubsByNewUser : clubsByExistingUser
      if (!bucket.has(club.user_id)) bucket.set(club.user_id, [])
      bucket.get(club.user_id).push(club)
    }

    // ── 4. For Group B (existing users adding clubs), look up their owner info ──
    //    We need first_name/last_name/email of the owner — pull from any of their existing locations
    const existingUserIds = [...clubsByExistingUser.keys()]
    let existingUserInfo = new Map() // user_id -> { name, email }

    if (existingUserIds.length) {
      const { data: ownerRows } = await supabase
        .from('locations')
        .select('user_id, first_name, last_name, club_email')
        .in('user_id', existingUserIds)
        .order('club_index', { ascending: true })

      // Take the first row per user_id (typically club_index=0, the primary)
      for (const row of ownerRows || []) {
        if (!existingUserInfo.has(row.user_id)) {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
          existingUserInfo.set(row.user_id, {
            name: fullName || null,
            email: row.club_email || null,
          })
        }
      }

      // Also fetch auth emails as fallback
      for (const uid of existingUserIds) {
        if (!existingUserInfo.get(uid)?.email) {
          const { data: authUser } = await supabase.auth.admin.getUserById(uid)
          if (authUser?.user?.email) {
            const info = existingUserInfo.get(uid) || { name: null, email: null }
            info.email = authUser.user.email
            existingUserInfo.set(uid, info)
          }
        }
      }
    }

    // ── 5. Build Group A data: new users + their clubs ──
    const groupA = newUsers.map(user => ({
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
      clubs: clubsByNewUser.get(user.id) || [],
    }))

    // ── 6. Build Group B data: existing users w/ new clubs ──
    const groupB = existingUserIds.map(uid => ({
      user_id: uid,
      email: existingUserInfo.get(uid)?.email || '(no email on file)',
      name: existingUserInfo.get(uid)?.name || '(no name on file)',
      clubs: clubsByExistingUser.get(uid),
    }))

    // ── 7. Skip sending if there's literally nothing to report ──
    if (groupA.length === 0 && groupB.length === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'No activity in last 24h' })
    }

    // ── 8. Build branded HTML email ──
    const html = buildDigestHtml({ groupA, groupB, since })
    const subject = buildSubject({ newUsers: groupA.length, newClubs: allClubs.length, additions: groupB.length })

    // ── 9. Send via Brevo ──
    const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME || 'MyClubLocator',
        },
        to: [{ email: process.env.ADMIN_NOTIFICATION_EMAIL }],
        subject,
        htmlContent: html,
      }),
    })

    if (!brevoResp.ok) {
      const errText = await brevoResp.text()
      throw new Error(`Brevo send failed (${brevoResp.status}): ${errText}`)
    }

    const brevoData = await brevoResp.json().catch(() => ({}))
    return res.status(200).json({
      ok: true,
      sent: true,
      messageId: brevoData.messageId || null,
      stats: {
        newUsers: groupA.length,
        existingUsersWithNewClubs: groupB.length,
        totalNewClubs: allClubs.length,
      }
    })

  } catch (err) {
    console.error('[daily-digest] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML builders
// ═══════════════════════════════════════════════════════════════════════════

function buildSubject({ newUsers, newClubs, additions }) {
  const parts = []
  if (newUsers > 0) parts.push(`${newUsers} new ${newUsers === 1 ? 'signup' : 'signups'}`)
  if (additions > 0) parts.push(`${additions} club ${additions === 1 ? 'addition' : 'additions'}`)
  if (newClubs > 0 && parts.length === 0) parts.push(`${newClubs} new ${newClubs === 1 ? 'club' : 'clubs'}`)
  const summary = parts.join(' · ')
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `[MyClubLocator] Daily digest · ${summary} · ${date}`
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  } catch { return '' }
}

function clubCard(club) {
  const name = escapeHtml(club.club_name || '(unnamed club)')
  const owner = [club.first_name, club.last_name].filter(Boolean).join(' ').trim()
  const location = [club.city, club.state].filter(Boolean).join(', ')
  const fullAddr = [club.address, club.city, club.state, club.zip].filter(Boolean).join(', ')
  const statusBadge = club.status === 'orphaned'
    ? `<span style="display:inline-block;background:#fff4e6;color:#b8651f;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:6px;text-transform:uppercase;letter-spacing:0.4px;">Orphaned</span>`
    : (club.approved === false
        ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:6px;text-transform:uppercase;letter-spacing:0.4px;">Pending</span>`
        : `<span style="display:inline-block;background:#E8F5EE;color:#2d7a52;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;margin-left:6px;text-transform:uppercase;letter-spacing:0.4px;">Live</span>`)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf9;border:1px solid #e8ede8;border-radius:8px;margin:0 0 8px;">
      <tr>
        <td style="padding:12px 14px;">
          <div style="font-size:14px;font-weight:600;color:#1A3C2E;margin:0 0 4px;">
            ${name}${statusBadge}
          </div>
          ${owner ? `<div style="font-size:12px;color:#666;margin:0 0 2px;">Owner: ${escapeHtml(owner)}</div>` : ''}
          ${fullAddr ? `<div style="font-size:12px;color:#888;margin:0;">${escapeHtml(fullAddr)}</div>` : (location ? `<div style="font-size:12px;color:#888;margin:0;">${escapeHtml(location)}</div>` : '')}
          <div style="font-size:11px;color:#aaa;margin-top:4px;">Created ${fmtDate(club.created_at)}</div>
        </td>
      </tr>
    </table>
  `
}

function newUserBlock(user) {
  const clubsHtml = user.clubs.length
    ? user.clubs.map(clubCard).join('')
    : `<div style="font-size:12px;color:#999;font-style:italic;padding:8px 14px;background:#fafafa;border-radius:6px;">No club created yet — signed up only</div>`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e0e7e2;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="background:#ffffff;padding:14px 16px;border-bottom:1px solid #f0f0f0;">
          <div style="font-size:14px;font-weight:600;color:#1A3C2E;">${escapeHtml(user.email)}</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">Signed up ${fmtDate(user.created_at)} · ${user.clubs.length} ${user.clubs.length === 1 ? 'club' : 'clubs'}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px 14px;background:#ffffff;">
          ${clubsHtml}
        </td>
      </tr>
    </table>
  `
}

function existingUserBlock(entry) {
  const clubsHtml = entry.clubs.map(clubCard).join('')
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e0e7e2;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="background:#ffffff;padding:14px 16px;border-bottom:1px solid #f0f0f0;">
          <div style="font-size:14px;font-weight:600;color:#1A3C2E;">${escapeHtml(entry.name)}</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">${escapeHtml(entry.email)}</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">Added ${entry.clubs.length} new ${entry.clubs.length === 1 ? 'club' : 'clubs'}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px 14px;background:#ffffff;">
          ${clubsHtml}
        </td>
      </tr>
    </table>
  `
}

function sectionHeader(label, count, accent) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
      <tr>
        <td>
          <div style="display:inline-block;background:${accent.bg};color:${accent.fg};font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.5px;">
            ${label} · ${count}
          </div>
        </td>
      </tr>
    </table>
  `
}

function buildDigestHtml({ groupA, groupB, since }) {
  const totalClubs = groupA.reduce((sum, u) => sum + u.clubs.length, 0) + groupB.reduce((sum, u) => sum + u.clubs.length, 0)
  const sinceFmt = new Date(since).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const nowFmt = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const groupASection = groupA.length ? `
    ${sectionHeader('New User Profiles', groupA.length, { bg: '#E8F5EE', fg: '#2d7a52' })}
    ${groupA.map(newUserBlock).join('')}
  ` : ''

  const groupBSection = groupB.length ? `
    ${sectionHeader('New Clubs from Existing Profiles', groupB.length, { bg: '#FFF4E6', fg: '#b8651f' })}
    ${groupB.map(existingUserBlock).join('')}
  ` : ''

  const dividerBetween = (groupA.length && groupB.length) ? `<tr><td style="padding:8px 0 16px;"><div style="height:1px;background:linear-gradient(to right,transparent,#e0e7e2,transparent);"></div></td></tr>` : ''

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;padding:40px 20px;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);max-width:600px;">

        <!-- Dark green header -->
        <tr>
          <td style="background:#1A3C2E;padding:28px 32px 24px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:40px;height:40px;background:rgba(76,175,130,0.15);border-radius:10px;text-align:center;vertical-align:middle;">
                        <img src="https://myclublocator.com/icon-48.png" width="26" height="26" alt="" style="display:block;margin:0 auto;" />
                      </td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <div style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1;">
                          My<span style="color:#4CAF82;">Club</span>Locator
                        </div>
                        <div style="font-size:11px;color:#a8c4b6;margin-top:3px;letter-spacing:0.4px;text-transform:uppercase;">
                          Admin · Daily Digest
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Summary stats -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <h1 style="font-size:20px;font-weight:700;color:#1A3C2E;margin:0 0 6px;letter-spacing:-0.3px;">
              ${(groupA.length + groupB.length) === 0 ? 'Quiet day on the platform' : 'Here\'s what happened today'}
            </h1>
            <p style="font-size:13px;color:#888;line-height:1.5;margin:0 0 20px;">
              Activity from ${sinceFmt} to ${nowFmt}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf9;border:1px solid #e8ede8;border-radius:10px;margin:0 0 24px;">
              <tr>
                <td width="33%" style="padding:14px 8px;text-align:center;border-right:1px solid #e8ede8;">
                  <div style="font-size:24px;font-weight:700;color:#1A3C2E;line-height:1;">${groupA.length}</div>
                  <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">New Signups</div>
                </td>
                <td width="33%" style="padding:14px 8px;text-align:center;border-right:1px solid #e8ede8;">
                  <div style="font-size:24px;font-weight:700;color:#4CAF82;line-height:1;">${totalClubs}</div>
                  <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">New Clubs</div>
                </td>
                <td width="33%" style="padding:14px 8px;text-align:center;">
                  <div style="font-size:24px;font-weight:700;color:#b8651f;line-height:1;">${groupB.length}</div>
                  <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Adding to Existing</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Group A: new users -->
        ${groupASection ? `
        <tr>
          <td style="padding:0 32px 8px;">
            ${groupASection}
          </td>
        </tr>` : ''}

        ${dividerBetween}

        <!-- Group B: existing users with new clubs -->
        ${groupBSection ? `
        <tr>
          <td style="padding:0 32px 8px;">
            ${groupBSection}
          </td>
        </tr>` : ''}

        <!-- CTA -->
        <tr>
          <td style="padding:8px 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://myclublocator.com/app/admin" target="_blank" style="display:inline-block;background:#4CAF82;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;letter-spacing:0.2px;">
                    Open admin panel &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faf9;padding:18px 32px;border-top:1px solid #f0f0f0;">
            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">
              <strong style="color:#888;">My Club Locator</strong> &middot; Daily admin digest, sent automatically each morning.
            </p>
            <p style="font-size:11px;color:#ccc;margin:4px 0 0;">
              You're receiving this because your address is set as ADMIN_NOTIFICATION_EMAIL in the platform settings.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
  `
}
