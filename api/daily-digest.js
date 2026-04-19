// ═══════════════════════════════════════════════════════════════════════════
// Daily admin digest — runs once per day via Vercel Cron
// ═══════════════════════════════════════════════════════════════════════════
//
// Sends ONE summary email per day to the admin containing:
//   • Group A: New user profiles from the last 24h (with their clubs, or signup-only status)
//   • Group B: New clubs added by EXISTING profiles in the last 24h
//
// REQUIRED ENV VARS:
//   BREVO_API_KEY, ADMIN_NOTIFICATION_EMAIL, BREVO_SENDER_EMAIL,
//   BREVO_SENDER_NAME (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   CRON_SECRET
//
// SCHEDULE: vercel.json runs daily at 00:00 UTC (= 8 PM EDT / 7 PM EST)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const SITE_URL = 'https://myclublocator.com'
const EASTERN_TZ = 'America/New_York'

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const required = ['BREVO_API_KEY', 'ADMIN_NOTIFICATION_EMAIL', 'BREVO_SENDER_EMAIL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` })
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // ── 1. New auth.users in last 24h ──
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersErr) throw new Error(`auth.admin.listUsers failed: ${usersErr.message}`)
    const newUsers = (usersData?.users || []).filter(u => u.created_at && u.created_at >= since)
    const newUserIds = new Set(newUsers.map(u => u.id))

    // ── 2. All clubs created in last 24h ──
    const { data: newClubsData, error: clubsErr } = await supabase
      .from('locations')
      .select('id, user_id, club_name, first_name, last_name, club_email, city, state, address, zip, created_at, status, approved, owner_photo_url, monthly_rent, square_footage')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    if (clubsErr) throw new Error(`locations query failed: ${clubsErr.message}`)
    const allClubs = newClubsData || []

    // ── 3. Split clubs into new-user vs existing-user buckets ──
    const clubsByNewUser = new Map()
    const clubsByExistingUser = new Map()
    for (const club of allClubs) {
      if (!club.user_id) continue
      const bucket = newUserIds.has(club.user_id) ? clubsByNewUser : clubsByExistingUser
      if (!bucket.has(club.user_id)) bucket.set(club.user_id, [])
      bucket.get(club.user_id).push(club)
    }

    // ── 4. Status lookup for new users without clubs ──
    const newUserStatuses = new Map()
    const usersNeedingStatus = newUsers.filter(u => !clubsByNewUser.has(u.id)).map(u => u.id)

    if (usersNeedingStatus.length) {
      const { data: pubAccts } = await supabase
        .from('public_accounts')
        .select('auth_user_id, display_name, email')
        .in('auth_user_id', usersNeedingStatus)
      const publicSet = new Set((pubAccts || []).map(p => p.auth_user_id))

      const { data: utaRows } = await supabase
        .from('user_terms_acceptance')
        .select('user_id, onboarding_done, pending_survey')
        .in('user_id', usersNeedingStatus)
      const utaByUser = new Map((utaRows || []).map(r => [r.user_id, r]))

      for (const uid of usersNeedingStatus) {
        if (publicSet.has(uid)) {
          const pub = (pubAccts || []).find(p => p.auth_user_id === uid)
          newUserStatuses.set(uid, {
            status: 'public_account',
            firstName: pub?.display_name || null,
            lastName: null,
            photoUrl: null,
          })
          continue
        }

        const uta = utaByUser.get(uid)
        let firstName = null, lastName = null
        if (uta?.pending_survey) {
          try {
            const parsed = typeof uta.pending_survey === 'string' ? JSON.parse(uta.pending_survey) : uta.pending_survey
            firstName = parsed.first_name || null
            lastName = parsed.last_name || null
          } catch { /* ignore */ }
        }

        newUserStatuses.set(uid, {
          status: uta?.onboarding_done ? 'onboarded_no_club' : 'onboarding_incomplete',
          firstName,
          lastName,
          photoUrl: null,
        })
      }
    }

    // ── 5. Existing-user owner info ──
    const existingUserIds = [...clubsByExistingUser.keys()]
    const existingUserInfo = new Map()
    if (existingUserIds.length) {
      const { data: ownerRows } = await supabase
        .from('locations')
        .select('user_id, first_name, last_name, club_email, owner_photo_url, club_index')
        .in('user_id', existingUserIds)

      const sorted = (ownerRows || []).sort((a, b) => (a.club_index ?? 999) - (b.club_index ?? 999))

      for (const row of sorted) {
        if (!existingUserInfo.has(row.user_id)) {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
          existingUserInfo.set(row.user_id, {
            name: fullName || null,
            firstName: row.first_name || null,
            lastName: row.last_name || null,
            email: row.club_email || null,
            photoUrl: row.owner_photo_url || null,
          })
        }
      }

      for (const uid of existingUserIds) {
        if (!existingUserInfo.get(uid)?.email) {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(uid)
            if (authUser?.user?.email) {
              const info = existingUserInfo.get(uid) || { name: null, firstName: null, lastName: null, email: null, photoUrl: null }
              info.email = authUser.user.email
              info.emailIsSignup = true
              existingUserInfo.set(uid, info)
            }
          } catch { /* ignore */ }
        }
      }
    }

    // ── 6. Group A data ──
    const groupA = newUsers.map(user => {
      const clubs = clubsByNewUser.get(user.id) || []
      if (clubs.length) {
        const primary = clubs.find(c => (c.club_index ?? 0) === 0) || clubs[0]
        return {
          type: 'with_clubs',
          user_id: user.id,
          authEmail: user.email,
          firstName: primary.first_name || null,
          lastName: primary.last_name || null,
          photoUrl: primary.owner_photo_url || null,
          clubs,
          created_at: user.created_at,
        }
      } else {
        const info = newUserStatuses.get(user.id) || { status: 'onboarding_incomplete', firstName: null, lastName: null, photoUrl: null }
        return {
          type: 'signup_only',
          user_id: user.id,
          authEmail: user.email,
          firstName: info.firstName,
          lastName: info.lastName,
          photoUrl: info.photoUrl,
          status: info.status,
          created_at: user.created_at,
        }
      }
    })

    // ── 7. Group B data ──
    const groupB = existingUserIds.map(uid => {
      const info = existingUserInfo.get(uid) || {}
      return {
        user_id: uid,
        firstName: info.firstName || null,
        lastName: info.lastName || null,
        email: info.email || '(no email on file)',
        emailIsSignup: !!info.emailIsSignup,
        photoUrl: info.photoUrl || null,
        clubs: clubsByExistingUser.get(uid),
      }
    })

    if (groupA.length === 0 && groupB.length === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'No activity in last 24h' })
    }

    const html = buildDigestHtml({ groupA, groupB, since })
    const subject = buildSubject({ groupA, groupB, allClubs })

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

function buildSubject({ groupA, groupB, allClubs }) {
  const newUsers = groupA.length
  const additions = groupB.length
  const parts = []
  if (newUsers > 0) parts.push(`${newUsers} new ${newUsers === 1 ? 'signup' : 'signups'}`)
  if (additions > 0) parts.push(`${additions} club ${additions === 1 ? 'addition' : 'additions'}`)
  if (parts.length === 0 && allClubs.length > 0) parts.push(`${allClubs.length} new ${allClubs.length === 1 ? 'club' : 'clubs'}`)
  const summary = parts.join(' · ')
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: EASTERN_TZ })
  return `[MyClubLocator] Daily digest · ${summary} · ${date}`
}

function escapeHtml(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escapeUrl(s) { return encodeURIComponent(String(s || '')) }

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: EASTERN_TZ
    })
  } catch { return '' }
}

function fmtCurrency(val) {
  if (val == null || val === '' || isNaN(Number(val))) return null
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtNumber(val) {
  if (val == null || val === '' || isNaN(Number(val))) return null
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtPerSqFt(rent, sqft) {
  const r = Number(rent), s = Number(sqft)
  if (!isFinite(r) || !isFinite(s) || s <= 0 || r <= 0) return null
  return '$' + (r / s).toFixed(2)
}

function initials(firstName, lastName, emailFallback) {
  const f = (firstName || '').trim()
  const l = (lastName || '').trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f) return f.slice(0, 2).toUpperCase()
  if (l) return l.slice(0, 2).toUpperCase()
  if (emailFallback) return emailFallback.slice(0, 2).toUpperCase()
  return '?'
}

function ownerAvatar({ photoUrl, firstName, lastName, emailFallback, bgColor, fgColor }) {
  if (photoUrl) {
    return `<img src="${escapeHtml(photoUrl)}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border-radius:50%;object-fit:cover;border:0.5px solid #e0e7e2;" />`
  }
  const bg = bgColor || '#E8F5EE'
  const fg = fgColor || '#2d7a52'
  const text = escapeHtml(initials(firstName, lastName, emailFallback))
  return `<div style="width:34px;height:34px;border-radius:50%;background:${bg};color:${fg};font-size:12px;font-weight:600;line-height:34px;text-align:center;font-family:'DM Sans',sans-serif;">${text}</div>`
}

function financialsStrip(club) {
  const rent = fmtCurrency(club.monthly_rent)
  const sqft = fmtNumber(club.square_footage)
  const pps = fmtPerSqFt(club.monthly_rent, club.square_footage)

  const cell = (label, value, accent) => `
    <td style="padding:0 14px 0 0;font-size:10px;color:#888;white-space:nowrap;">
      <span style="text-transform:uppercase;letter-spacing:0.4px;color:#aaa;">${label}</span>
      <span style="color:${accent === 'green' && value ? '#2d7a52' : (value ? '#1A3C2E' : '#ccc')};font-weight:${value ? 600 : 400};font-size:11px;margin-left:4px;">${value || '—'}</span>
    </td>
  `
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-top:0.5px solid #f0f0f0;border-bottom:0.5px solid #f0f0f0;margin:8px 0;">
      <tr>
        <td style="padding:6px 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              ${cell('Rent', rent)}
              ${cell('Sq ft', sqft)}
              ${cell('Per sq ft', pps, 'green')}
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function statusBadge(status) {
  const map = {
    onboarding_incomplete: { label: 'Onboarding incomplete', bg: '#fef3c7', fg: '#92400e', dot: '#f59e0b' },
    onboarded_no_club:     { label: 'Onboarded · no club yet', bg: '#dbeafe', fg: '#1e40af', dot: '#3b82f6' },
    public_account:        { label: 'Browsing only', bg: '#f3f4f6', fg: '#4b5563', dot: '#9ca3af' },
  }
  const s = map[status] || map.onboarding_incomplete
  return `
    <span style="display:inline-block;background:${s.bg};color:${s.fg};font-size:9px;font-weight:600;padding:3px 9px;border-radius:10px;text-transform:uppercase;letter-spacing:0.4px;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${s.dot};margin-right:5px;vertical-align:middle;"></span>
      ${escapeHtml(s.label)}
    </span>
  `
}

function statusCardColors(status) {
  const map = {
    onboarding_incomplete: { border: '#fde68a', bg: '#fffbeb', avatarBg: '#fef3c7', avatarFg: '#92400e' },
    onboarded_no_club:     { border: '#c7d7ed', bg: '#f5f9ff', avatarBg: '#dbeafe', avatarFg: '#1e40af' },
    public_account:        { border: '#e5e5e5', bg: '#fafafa', avatarBg: '#f3f4f6', avatarFg: '#4b5563' },
  }
  return map[status] || map.onboarding_incomplete
}

function clubCard(club, owner) {
  const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || '(name not provided)'
  const clubName = escapeHtml(club.club_name || '(unnamed club)')
  const fullAddr = [club.address, club.city, club.state, club.zip].filter(Boolean).join(', ')

  const badgeHtml = club.status === 'orphaned'
    ? `<span style="display:inline-block;background:#fff4e6;color:#b8651f;font-size:9px;font-weight:600;padding:2px 7px;border-radius:8px;text-transform:uppercase;letter-spacing:0.3px;margin-left:6px;">Orphaned</span>`
    : (club.approved === false
        ? `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:9px;font-weight:600;padding:2px 7px;border-radius:8px;text-transform:uppercase;letter-spacing:0.3px;margin-left:6px;">Pending</span>`
        : `<span style="display:inline-block;background:#E8F5EE;color:#2d7a52;font-size:9px;font-weight:600;padding:2px 7px;border-radius:8px;text-transform:uppercase;letter-spacing:0.3px;margin-left:6px;">Live</span>`)

  const displayEmail = club.club_email || owner.fallbackEmail || ''
  const emailSuffix = (!club.club_email && owner.fallbackEmail)
    ? ` <span style="color:#aaa;font-style:italic;">(signup)</span>`
    : ''

  const dirLink = `${SITE_URL}/app/directory?club_id=${escapeUrl(club.id)}`
  const adminLink = `${SITE_URL}/app/admin?club_id=${escapeUrl(club.id)}`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:0.5px solid #e0e7e2;border-radius:8px;margin:0 0 10px;background:#ffffff;">
      <tr>
        <td style="padding:12px 14px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:0.5px solid #f0f0f0;">
            <tr>
              <td style="padding:0 0 8px;vertical-align:middle;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">${ownerAvatar({ photoUrl: owner.photoUrl, firstName: owner.firstName, lastName: owner.lastName, emailFallback: displayEmail })}</td>
                    <td style="vertical-align:middle;font-size:15px;font-weight:600;color:#1A3C2E;font-family:'DM Sans',sans-serif;">${escapeHtml(ownerName)}</td>
                  </tr>
                </table>
              </td>
              <td align="right" style="padding:0 0 8px;vertical-align:middle;font-size:10px;color:#888;">
                ${escapeHtml(displayEmail)}${emailSuffix}
              </td>
            </tr>
          </table>

          <div style="margin:8px 0 3px;">
            <a href="${dirLink}" target="_blank" style="font-size:16px;font-weight:600;color:#2d7a52;text-decoration:none;font-family:'DM Sans',sans-serif;">
              ${clubName}${badgeHtml} <span style="font-size:11px;color:#4CAF82;opacity:0.7;">&rarr;</span>
            </a>
          </div>

          ${fullAddr ? `<div style="font-size:11px;color:#888;margin:0 0 8px;">${escapeHtml(fullAddr)}</div>` : ''}

          ${financialsStrip(club)}

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:10px;color:#aaa;">${fmtDate(club.created_at)}</td>
              <td align="right">
                <a href="${adminLink}" target="_blank" style="font-size:10px;color:#888;text-decoration:none;padding:2px 8px;border:0.5px solid #ddd;border-radius:10px;background:#fafafa;display:inline-block;">
                  Admin view &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function newUserEntry(user) {
  if (user.type === 'with_clubs') {
    return user.clubs.map(club => clubCard(club, {
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      fallbackEmail: user.authEmail,
    })).join('')
  }

  const colors = statusCardColors(user.status)
  const ownerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  const nameDisplay = ownerName
    ? escapeHtml(ownerName)
    : `<span style="color:#888;font-style:italic;font-weight:400;">(unknown name)</span>`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:0.5px solid ${colors.border};border-radius:8px;margin:0 0 10px;background:${colors.bg};">
      <tr>
        <td style="padding:12px 14px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">${ownerAvatar({ firstName: user.firstName, lastName: user.lastName, emailFallback: user.authEmail, bgColor: colors.avatarBg, fgColor: colors.avatarFg })}</td>
                    <td style="vertical-align:middle;font-size:15px;font-weight:600;color:#1A3C2E;font-family:'DM Sans',sans-serif;">${nameDisplay}</td>
                  </tr>
                </table>
              </td>
              <td align="right" style="vertical-align:middle;font-size:11px;color:#888;">${escapeHtml(user.authEmail || '')}</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;padding-top:6px;border-top:0.5px solid rgba(0,0,0,0.05);">
            <tr>
              <td>${statusBadge(user.status)}</td>
              <td align="right" style="font-size:10px;color:#aaa;">${fmtDate(user.created_at)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function existingUserEntry(entry) {
  return entry.clubs.map(club => clubCard(club, {
    firstName: entry.firstName,
    lastName: entry.lastName,
    photoUrl: entry.photoUrl,
    fallbackEmail: entry.email,
  })).join('')
}

function sectionHeader(label, count) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 10px;">
      <tr>
        <td style="background:#1A3C2E;padding:9px 14px;border-radius:6px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;font-family:'DM Sans',sans-serif;">${escapeHtml(label)}</td>
              <td align="right">
                <span style="display:inline-block;background:#4CAF82;color:#ffffff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${count}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

function buildDigestHtml({ groupA, groupB, since }) {
  const totalClubs = groupA.reduce((sum, u) => sum + (u.clubs?.length || 0), 0) + groupB.reduce((sum, u) => sum + u.clubs.length, 0)
  const sinceFmt = new Date(since).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: EASTERN_TZ })
  const nowFmt = new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: EASTERN_TZ })

  const groupASection = groupA.length ? `${sectionHeader('New User Profiles', groupA.length)}${groupA.map(newUserEntry).join('')}` : ''
  const groupBSection = groupB.length ? `${sectionHeader('New Clubs from Existing Profiles', groupB.length)}${groupB.map(existingUserEntry).join('')}` : ''

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;padding:40px 20px;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);max-width:600px;">

        <tr>
          <td style="background:#1A3C2E;padding:22px 28px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:40px;height:40px;background:rgba(76,175,130,0.15);border-radius:10px;text-align:center;vertical-align:middle;">
                  <img src="${SITE_URL}/icon-48.png" width="26" height="26" alt="" style="display:block;margin:0 auto;" />
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

        <tr>
          <td style="padding:22px 28px 8px;">
            <h1 style="font-size:20px;font-weight:700;color:#1A3C2E;margin:0 0 6px;letter-spacing:-0.3px;">
              ${(groupA.length + groupB.length) === 0 ? 'Quiet day on the platform' : "Here's what happened today"}
            </h1>
            <p style="font-size:12px;color:#888;line-height:1.5;margin:0 0 18px;">
              Activity from ${sinceFmt} to ${nowFmt}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf9;border:0.5px solid #e8ede8;border-radius:8px;margin:0 0 8px;">
              <tr>
                <td width="33%" style="padding:12px 6px;text-align:center;border-right:0.5px solid #e8ede8;">
                  <div style="font-size:22px;font-weight:700;color:#1A3C2E;line-height:1;">${groupA.length}</div>
                  <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">New Signups</div>
                </td>
                <td width="33%" style="padding:12px 6px;text-align:center;border-right:0.5px solid #e8ede8;">
                  <div style="font-size:22px;font-weight:700;color:#4CAF82;line-height:1;">${totalClubs}</div>
                  <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">New Clubs</div>
                </td>
                <td width="33%" style="padding:12px 6px;text-align:center;">
                  <div style="font-size:22px;font-weight:700;color:#b8651f;line-height:1;">${groupB.length}</div>
                  <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;">Adding to Existing</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${groupASection ? `<tr><td style="padding:0 28px;">${groupASection}</td></tr>` : ''}
        ${groupBSection ? `<tr><td style="padding:0 28px;">${groupBSection}</td></tr>` : ''}

        <tr>
          <td style="padding:8px 28px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${SITE_URL}/app/admin" target="_blank" style="display:inline-block;background:#4CAF82;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;letter-spacing:0.2px;">
                    Open admin panel &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8faf9;padding:18px 28px;border-top:0.5px solid #f0f0f0;">
            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">
              <strong style="color:#888;">My Club Locator</strong> &middot; Daily admin digest, sent automatically each evening.
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
