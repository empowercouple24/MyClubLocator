import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TABS = ['settings', 'contacts', 'members']

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY

function ContactCard({ submission: c, onReplySent }) {
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState('')
  const replies = c.replies || []

  async function handleSendReply(e) {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSending(true)
    setSendError('')

    try {
      // Send via Brevo API
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: 'My Club Locator', email: 'hello@myclublocator.com' },
          to: [{ email: c.email, name: c.name }],
          subject: `Re: ${c.name}`,
          textContent: replyBody,
          htmlContent: `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;">${replyBody.replace(/\n/g, '<br/>')}</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="font-size:12px;color:#aaa;">My Club Locator · hello@myclublocator.com</p>`,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Send failed')
      }

      // Save reply to Supabase
      const { data: saved, error: dbErr } = await supabase
        .from('contact_replies')
        .insert({ submission_id: c.id, reply_body: replyBody })
        .select()
        .single()

      if (dbErr) throw new Error(dbErr.message)

      onReplySent(saved)
      setReplyBody('')
    } catch (err) {
      setSendError(err.message || 'Something went wrong. Please try again.')
    }

    setSending(false)
  }

  return (
    <div className="contact-submission-card">
      <div className="csub-header">
        <div className="csub-avatar">{(c.name || '?').slice(0,1).toUpperCase()}</div>
        <div className="csub-meta">
          <div className="csub-name">{c.name}</div>
          <div className="csub-email">{c.email}</div>
        </div>
        <div className="csub-date">
          {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="csub-message">{c.message}</div>

      {/* Sent replies */}
      {replies.length > 0 && (
        <div className="csub-replies">
          {replies
            .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at))
            .map(r => (
              <div key={r.id} className="csub-sent-reply">
                <div className="csub-sent-label">Your reply</div>
                <div className="csub-sent-text">{r.reply_body}</div>
                <div className="csub-sent-time">
                  {new Date(r.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · hello@myclublocator.com
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Reply form */}
      <form className="csub-reply-form" onSubmit={handleSendReply}>
        <div className="csub-reply-label">{replies.length > 0 ? 'Send another reply' : 'Reply'}</div>
        <div className="csub-reply-subject">Subject: <span>Re: {c.name}</span></div>
        {sendError && <div className="error-msg" style={{ marginBottom: 8 }}>{sendError}</div>}
        <textarea
          className="csub-reply-textarea"
          placeholder="Type your reply…"
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          rows={4}
          required
        />
        <div className="csub-reply-footer">
          <div className="csub-reply-from">From: <span>hello@myclublocator.com</span></div>
          <button className="csub-send-btn" type="submit" disabled={sending || !replyBody.trim()}>
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ToggleSwitch({ on, onChange }) {
  return (
    <button className={`toggle-btn ${on ? 'on' : 'off'}`} onClick={() => onChange(!on)}>
      <span className="toggle-thumb" />
    </button>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-value" style={{ color: color || '#1A3C2E' }}>{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  )
}

export default function AdminPage() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('settings')

  // Members state
  const [members, setMembers]           = useState([])
  const [allUsers, setAllUsers]         = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [searchMember, setSearchMember] = useState('')
  const [filterProfile, setFilterProfile] = useState('all') // all | complete | incomplete
  const [filterApproval, setFilterApproval] = useState('all') // all | approved | pending
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [memberMsg, setMemberMsg]         = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [sortBy, setSortBy]               = useState('joined_desc')

  // Settings state
  const [settings, setSettings] = useState({
    welcome_video_enabled: false,
    welcome_video_url: '',
    welcome_video_placeholder: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    welcome_title: 'Welcome to My Club Locator!',
    welcome_message: "You're now part of the network. Watch the video below to get started, then add your club to the map.",
    welcome_disclaimer: '',
    require_approval: false,
    demo_population: true,
    demo_income: true,
    demo_age_fit: true,
    demo_poverty: true,
    demo_competition: true,
    demo_unemployment: true,
    demo_households: true,
    demo_median_age: true,
    demo_health: true,
    demo_spending: true,
    demo_growth: true,
    demo_commute: true,
    demo_competitors: true,
  })
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings]   = useState(false)
  const [savedSettings, setSavedSettings]     = useState(false)
  const [previewModal, setPreviewModal]       = useState(null) // 'message' | 'disclaimer' | null

  // Contacts state
  const [contacts, setContacts]             = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsLoaded, setContactsLoaded]   = useState(false)
  const [notifications, setNotifications]     = useState([])
  const [notifLoaded, setNotifLoaded]         = useState(false)
  const [msgSubTab, setMsgSubTab]             = useState('contact') // 'contact' | 'members'

  // Unread counts
  const unreadContacts = contacts.filter(c => !c.is_read).length
  const unreadNotifs   = notifications.filter(n => !n.is_read).length
  const totalUnread    = unreadContacts + unreadNotifs

  // Real-time subscriptions
  useEffect(() => {
    if (!isAdmin) return
    // Subscribe to contact_submissions
    const contactSub = supabase.channel('admin-contacts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_submissions' }, payload => {
        setContacts(prev => [{ ...payload.new, replies: [] }, ...prev])
      })
      .subscribe()
    // Subscribe to notifications
    const notifSub = supabase.channel('admin-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => {
      supabase.removeChannel(contactSub)
      supabase.removeChannel(notifSub)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) { navigate('/app/map'); return }
    loadMembers()
    loadSettings()
  }, [isAdmin])

  async function loadMembers() {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      // Fire pending_approval notifications for any newly pending members not yet notified
      const pending = data.filter(m => m.approved === false)
      for (const m of pending) {
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'pending_approval')
          .eq('user_id', m.user_id)
          .single()
        if (!existing) {
          await supabase.from('notifications').insert({
            type: 'pending_approval',
            title: 'New member awaiting approval',
            body: `${m.club_name || 'A new club'} from ${m.city || 'unknown location'} is pending your approval.`,
            user_id: m.user_id,
          })
        }
      }
      setMembers(data)
    }
    setLoadingMembers(false)
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (data) setSettings(s => ({ ...s, ...data }))
    setLoadingSettings(false)
  }

  async function loadContacts() {
    setLoadingContacts(true)
    const { data } = await supabase
      .from('contact_submissions')
      .select('*, replies:contact_replies(*)')
      .order('created_at', { ascending: false })
    if (data) setContacts(data)
    setLoadingContacts(false)
    setContactsLoaded(true)
  }

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setNotifications(data)
    setNotifLoaded(true)
  }

  async function markContactRead(id) {
    await supabase.from('contact_submissions').update({ is_read: true }).eq('id', id)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c))
  }

  async function markNotifRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllContactsRead() {
    await supabase.from('contact_submissions').update({ is_read: true }).eq('is_read', false)
    setContacts(prev => prev.map(c => ({ ...c, is_read: true })))
  }

  async function markAllNotifsRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function handleTabChange(t) {
    setTab(t)
    if (t === 'contacts') {
      if (!contactsLoaded) loadContacts()
      if (!notifLoaded) loadNotifications()
    }
  }

  async function handleApprove(member) {
    setActionLoading(member.id)
    await supabase.from('locations').update({
      approved: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', member.id)
    await loadMembers()
    setMemberMsg(`${member.club_name || 'Club'} approved.`)
    setTimeout(() => setMemberMsg(''), 3000)
    setActionLoading(null)
  }

  async function handleRevoke(member) {
    setActionLoading(member.id)
    await supabase.from('locations').update({ approved: false }).eq('id', member.id)
    await loadMembers()
    setMemberMsg(`${member.club_name || 'Club'} approval revoked.`)
    setTimeout(() => setMemberMsg(''), 3000)
    setActionLoading(null)
  }

  async function handleRemove(member) {
    setActionLoading(member.id)
    await supabase.from('locations').delete().eq('id', member.id)
    await loadMembers()
    setConfirmRemove(null)
    setMemberMsg(`${member.club_name || 'Club'} removed from registry.`)
    setTimeout(() => setMemberMsg(''), 3000)
    setActionLoading(null)
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    await supabase.from('app_settings').upsert({ id: 1, ...settings }, { onConflict: 'id' })
    setSavingSettings(false)
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 3000)
  }

  function profileComplete(m) {
    return !!(m.club_name && m.address && m.city &&
      ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
        .some(d => m[`hours_${d}_open`]))
  }

  const filteredMembers = members.filter(m => {
    const q = searchMember.toLowerCase()
    const ownerName = [m.first_name, m.last_name].filter(Boolean).join(' ').toLowerCase()
    const nameMatch = !q || (m.club_name || '').toLowerCase().includes(q) ||
      (m.city || '').toLowerCase().includes(q) || ownerName.includes(q)
    const profileMatch = filterProfile === 'all' ? true :
      filterProfile === 'complete' ? profileComplete(m) : !profileComplete(m)
    const approvalMatch = filterApproval === 'all' ? true :
      filterApproval === 'approved' ? m.approved !== false : m.approved === false
    return nameMatch && profileMatch && approvalMatch
  })

  const totalMembers  = members.length
  const completeCount = members.filter(profileComplete).length
  const pendingCount  = members.filter(m => m.approved === false).length
  const approvedCount = members.filter(m => m.approved !== false).length

  if (!isAdmin) return null

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>Admin Panel</h2>
        <p className="profile-sub">Manage members and platform settings.</p>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => handleTabChange(t)}>
            {t === 'members' ? 'Members' : t === 'settings' ? 'Settings' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Messages
                {totalUnread > 0 && (
                  <span style={{
                    background: '#e53e3e', color: '#fff', borderRadius: '10px',
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                  }}>{totalUnread}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <div>
          {/* Stats */}
          <div className="admin-stats-row">
            <StatCard label="Total members"    value={totalMembers} />
            <StatCard label="Profile complete" value={completeCount} color="#1A3C2E" />
            <StatCard label="Incomplete"       value={totalMembers - completeCount} color="#888" />
            <StatCard label="Pending approval" value={pendingCount} color={pendingCount > 0 ? '#e53e3e' : '#888'} />
          </div>

          {/* Filters */}
          <div className="admin-member-filters">
            <input className="search-input" type="text" placeholder="Search name, city, owner…"
              value={searchMember} onChange={e => setSearchMember(e.target.value)}
              style={{ flex: 1, minWidth: 180 }} />
            <select className="dir-sort" value={filterProfile} onChange={e => setFilterProfile(e.target.value)}>
              <option value="all">All profiles</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
            <select className="dir-sort" value={filterApproval} onChange={e => setFilterApproval(e.target.value)}>
              <option value="all">All status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
            <select className="dir-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="joined_desc">Newest first</option>
              <option value="joined_asc">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="city_asc">City A–Z</option>
              <option value="state_asc">State A–Z</option>
            </select>
          </div>

          {memberMsg && <div className="success-msg" style={{ marginBottom: 12 }}>{memberMsg}</div>}

          {loadingMembers ? (
            <div className="loading">Loading members…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="loading" style={{ height: 80 }}>No members found.</div>
          ) : (() => {
            // Sort
            const sorted = [...filteredMembers].sort((a, b) => {
              if (sortBy === 'name_asc')    return (a.club_name||'').localeCompare(b.club_name||'')
              if (sortBy === 'name_desc')   return (b.club_name||'').localeCompare(a.club_name||'')
              if (sortBy === 'city_asc')    return (a.city||'').localeCompare(b.city||'')
              if (sortBy === 'state_asc')   return (a.state||'').localeCompare(b.state||'')
              if (sortBy === 'joined_asc')  return new Date(a.created_at) - new Date(b.created_at)
              return new Date(b.created_at) - new Date(a.created_at)
            })

            const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
            const DAY_LABELS = ['M','T','W','T','F','S','S']

            function HoursDots({ m }) {
              return (
                <div className="amt-hours-dots">
                  {DAYS.map((d, i) => (
                    <span key={d} className={`amt-dot ${m[`hours_${d}_open`] ? 'open' : 'closed'}`}
                      title={d.charAt(0).toUpperCase() + d.slice(1)}>
                      {DAY_LABELS[i]}
                    </span>
                  ))}
                </div>
              )
            }

            function MemberDetailModal({ m, onClose }) {
              const complete  = profileComplete(m)
              const approved  = m.approved !== false
              const isMe      = m.user_id === user?.id
              const isLoading = actionLoading === m.id
              const ownerName = [m.first_name, m.last_name].filter(Boolean).join(' ')

              return (
                <div className="modal-overlay" onClick={onClose}>
                  <div className="amt-detail-modal" onClick={e => e.stopPropagation()}>
                    <div className="amt-detail-header">
                      <div className="amt-detail-logo-wrap">
                        {m.logo_url
                          ? <img src={m.logo_url} alt="logo" className="amt-detail-logo" />
                          : <div className="amt-detail-initials">{(m.club_name||'CL').slice(0,2).toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="amt-detail-name">{m.club_name || 'Unnamed Club'} {isMe && <span className="amr-you-badge">You</span>}</div>
                        <div className="amt-detail-sub">{ownerName}</div>
                      </div>
                      <button className="modal-close-btn" onClick={onClose}>✕</button>
                    </div>

                    <div className="amt-detail-body">
                      <div className="amt-detail-grid">
                        {m.club_email  && <><span className="amt-detail-label">Email</span><span>{m.club_email}</span></>}
                        {m.club_phone  && <><span className="amt-detail-label">Phone</span><span>{m.club_phone}</span></>}
                        {m.address     && <><span className="amt-detail-label">Address</span><span>{m.address}</span></>}
                        {m.city        && <><span className="amt-detail-label">City/State</span><span>{m.city}{m.state ? `, ${m.state}` : ''} {m.zip || ''}</span></>}
                        {m.website     && <><span className="amt-detail-label">Website</span><a href={m.website.startsWith('http') ? m.website : `https://${m.website}`} target="_blank" rel="noreferrer">{m.website}</a></>}
                        {(m.opened_month || m.opened_year) && <><span className="amt-detail-label">Opened</span><span>{m.opened_month} {m.opened_year}</span></>}
                        {m.created_at  && <><span className="amt-detail-label">Joined</span><span>{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></>}
                        {[m.owner2_first_name, m.owner2_last_name].filter(Boolean).join(' ') && (
                          <><span className="amt-detail-label">Owner 2</span><span>{[m.owner2_first_name, m.owner2_last_name].filter(Boolean).join(' ')}</span></>
                        )}
                        {[m.owner3_first_name, m.owner3_last_name].filter(Boolean).join(' ') && (
                          <><span className="amt-detail-label">Owner 3</span><span>{[m.owner3_first_name, m.owner3_last_name].filter(Boolean).join(' ')}</span></>
                        )}
                      </div>

                      <div className="amt-detail-section-title">Hours</div>
                      <div className="amt-detail-hours">
                        {DAYS.map((d, i) => {
                          const open  = m[`hours_${d}_open`]
                          const close = m[`hours_${d}_close`]
                          const fmt = t => {
                            if (!t) return ''
                            const [h, min] = t.split(':').map(Number)
                            const p = h < 12 ? 'AM' : 'PM'
                            const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
                            return `${hr}:${String(min).padStart(2,'0')} ${p}`
                          }
                          return (
                            <div key={d} className={`amt-detail-hours-row ${!open ? 'closed' : ''}`}>
                              <span className="amt-detail-day">{d.charAt(0).toUpperCase() + d.slice(1,3)}</span>
                              <span>{open ? `${fmt(open)} – ${fmt(close)}` : 'Closed'}</span>
                            </div>
                          )
                        })}
                      </div>

                      <div className="amt-detail-section-title">Social</div>
                      <div className="amt-detail-social">
                        {m.social_facebook  && <a href={m.social_facebook}  target="_blank" rel="noreferrer" className="cp-social-link">Facebook</a>}
                        {m.social_instagram && <a href={m.social_instagram} target="_blank" rel="noreferrer" className="cp-social-link">Instagram</a>}
                        {m.social_tiktok    && <a href={m.social_tiktok}    target="_blank" rel="noreferrer" className="cp-social-link">TikTok</a>}
                        {m.social_youtube   && <a href={m.social_youtube}   target="_blank" rel="noreferrer" className="cp-social-link">YouTube</a>}
                        {!m.social_facebook && !m.social_instagram && !m.social_tiktok && !m.social_youtube && (
                          <span style={{ fontSize: 12, color: '#aaa' }}>None set</span>
                        )}
                      </div>

                      <div className="amt-detail-badges">
                        <span className={`amr-badge ${complete ? 'badge-complete' : 'badge-incomplete'}`}>{complete ? '✓ Complete' : '⚠ Incomplete'}</span>
                        <span className={`amr-badge ${approved ? 'badge-approved' : 'badge-pending'}`}>{approved ? '✓ Approved' : '⏳ Pending'}</span>
                      </div>
                    </div>

                    {!isMe && (
                      <div className="amt-detail-actions">
                        {!approved ? (
                          <button className="amr-btn amr-btn-approve" disabled={isLoading}
                            onClick={() => { handleApprove(m); onClose() }}>
                            {isLoading ? '…' : 'Approve'}
                          </button>
                        ) : (
                          <button className="amr-btn amr-btn-revoke" disabled={isLoading}
                            onClick={() => { handleRevoke(m); onClose() }}>
                            {isLoading ? '…' : 'Revoke'}
                          </button>
                        )}
                        <button className="amr-btn amr-btn-remove" disabled={isLoading}
                          onClick={() => { setConfirmRemove(m); onClose() }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <>
                {selectedMember && (
                  <MemberDetailModal m={selectedMember} onClose={() => setSelectedMember(null)} />
                )}

                {/* ── Desktop table ── */}
                <div className="amt-table-wrap">
                  <table className="amt-table">
                    <thead>
                      <tr>
                        <th>Logo</th>
                        <th>Club name</th>
                        <th>Owner</th>
                        <th>City / State</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Opened</th>
                        <th>Hours</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(m => {
                        const complete  = profileComplete(m)
                        const approved  = m.approved !== false
                        const isMe      = m.user_id === user?.id
                        const isLoading = actionLoading === m.id
                        const ownerName = [m.first_name, m.last_name].filter(Boolean).join(' ')
                        return (
                          <tr key={m.id} className={!approved ? 'amt-row-pending' : ''}>
                            <td>
                              {m.logo_url
                                ? <img src={m.logo_url} alt="logo" className="amt-logo-thumb" />
                                : <div className="amt-initials-sm">{(m.club_name||'CL').slice(0,2).toUpperCase()}</div>
                              }
                            </td>
                            <td className="amt-cell-name">
                              {m.club_name || <span className="amt-empty">—</span>}
                              {isMe && <span className="amr-you-badge" style={{ marginLeft: 4 }}>You</span>}
                            </td>
                            <td>{ownerName || <span className="amt-empty">—</span>}</td>
                            <td>{m.city ? `${m.city}${m.state ? `, ${m.state}` : ''}` : <span className="amt-empty">—</span>}</td>
                            <td>{m.club_phone || <span className="amt-empty">—</span>}</td>
                            <td className="amt-cell-email">{m.club_email || <span className="amt-empty">—</span>}</td>
                            <td>{m.opened_month && m.opened_year ? `${m.opened_month.slice(0,3)} ${m.opened_year}` : <span className="amt-empty">—</span>}</td>
                            <td><HoursDots m={m} /></td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <span className={`amr-badge ${complete ? 'badge-complete' : 'badge-incomplete'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                  {complete ? '✓ Done' : '⚠ Incomplete'}
                                </span>
                                <span className={`amr-badge ${approved ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                                  {approved ? '✓ Approved' : '⏳ Pending'}
                                </span>
                              </div>
                            </td>
                            <td className="amt-cell-date">{m.created_at ? new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</td>
                            <td>
                              {!isMe && (
                                <div className="amt-actions">
                                  {!approved ? (
                                    <button className="amr-btn amr-btn-approve" style={{ fontSize: 11, padding: '3px 8px' }} disabled={isLoading} onClick={() => handleApprove(m)}>
                                      {isLoading ? '…' : 'Approve'}
                                    </button>
                                  ) : (
                                    <button className="amr-btn amr-btn-revoke" style={{ fontSize: 11, padding: '3px 8px' }} disabled={isLoading} onClick={() => handleRevoke(m)}>
                                      {isLoading ? '…' : 'Revoke'}
                                    </button>
                                  )}
                                  <button className="amr-btn amr-btn-remove" style={{ fontSize: 11, padding: '3px 8px' }} disabled={isLoading} onClick={() => setConfirmRemove(m)}>
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile cards ── */}
                <div className="amt-mobile-list">
                  {sorted.map(m => {
                    const complete = profileComplete(m)
                    const approved = m.approved !== false
                    const ownerName = [m.first_name, m.last_name].filter(Boolean).join(' ')
                    return (
                      <div key={m.id} className="amt-mobile-card" onClick={() => setSelectedMember(m)}>
                        <div className="amt-mobile-left">
                          {m.logo_url
                            ? <img src={m.logo_url} alt="logo" className="amt-logo-thumb" />
                            : <div className="amt-initials-sm">{(m.club_name||'CL').slice(0,2).toUpperCase()}</div>
                          }
                        </div>
                        <div className="amt-mobile-info">
                          <div className="amt-mobile-name">{m.club_name || 'Unnamed Club'}</div>
                          <div className="amt-mobile-sub">{ownerName}{m.city ? ` · ${m.city}${m.state ? `, ${m.state}` : ''}` : ''}</div>
                        </div>
                        <div className="amt-mobile-badges">
                          <span className={`amr-badge ${complete ? 'badge-complete' : 'badge-incomplete'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                            {complete ? '✓' : '⚠'}
                          </span>
                          <span className={`amr-badge ${approved ? 'badge-approved' : 'badge-pending'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                            {approved ? '✓' : '⏳'}
                          </span>
                        </div>
                        <span className="amt-mobile-arrow">›</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>
      )}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div>
          {loadingSettings ? <div className="loading">Loading settings…</div> : (
            <>
              {/* Welcome Modal */}
              <div className="admin-section">
                <h3 className="admin-section-title">Welcome Modal</h3>
                <p className="admin-section-desc">Controls the modal shown to members on first login.</p>

                <div className="admin-toggle-row">
                  <div>
                    <div className="admin-toggle-label">Show welcome video</div>
                    <div className="admin-toggle-hint">When off, modal shows without a video</div>
                  </div>
                  <ToggleSwitch on={settings.welcome_video_enabled}
                    onChange={v => setSettings(s => ({ ...s, welcome_video_enabled: v }))} />
                </div>

                <div className="fgrid">
                  <div className="field">
                    <label>Modal title</label>
                    <input type="text" value={settings.welcome_title}
                      onChange={e => setSettings(s => ({ ...s, welcome_title: e.target.value }))}
                      placeholder="Welcome to My Club Locator!" />
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <div className="admin-field-label-row">
                      <label>Welcome message</label>
                      <button className="admin-preview-btn" onClick={() => setPreviewModal('message')}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="6" r="1.2" fill="currentColor"/><line x1="8" y1="8.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Preview
                      </button>
                    </div>
                    <textarea rows={4} value={settings.welcome_message}
                      onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
                      className="admin-tall-textarea" />
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Video embed URL</label>
                    <input type="url" value={settings.welcome_video_url}
                      onChange={e => setSettings(s => ({ ...s, welcome_video_url: e.target.value }))}
                      placeholder="https://www.youtube.com/embed/VIDEO_ID"
                      disabled={!settings.welcome_video_enabled} />
                    <span className="field-hint">YouTube embed format: youtube.com/embed/VIDEO_ID</span>
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Video placeholder URL <span className="field-optional">shown until you set a real video</span></label>
                    <input type="url" value={settings.welcome_video_placeholder}
                      onChange={e => setSettings(s => ({ ...s, welcome_video_placeholder: e.target.value }))}
                      placeholder="https://www.youtube.com/embed/VIDEO_ID" />
                    <span className="field-hint">Shown to new users when no video URL is set above</span>
                  </div>

                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <div className="admin-field-label-row">
                      <label>Disclaimer text <span className="field-optional">shown to all users at bottom of modal</span></label>
                      <button className="admin-preview-btn" onClick={() => setPreviewModal('disclaimer')}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="6" r="1.2" fill="currentColor"/><line x1="8" y1="8.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Preview
                      </button>
                    </div>
                    <textarea rows={4} value={settings.welcome_disclaimer}
                      onChange={e => setSettings(s => ({ ...s, welcome_disclaimer: e.target.value }))}
                      placeholder="Enter your disclaimer here — e.g. terms of use, membership rules, etc."
                      className="admin-tall-textarea" />
                    <span className="field-hint">Leave blank to show the default placeholder text until you're ready</span>
                  </div>
                </div>
              </div>

              {/* Member Approval */}
              <div className="admin-section">
                <h3 className="admin-section-title">Member Approval</h3>
                <p className="admin-section-desc">When enabled, new signups must be approved before appearing on the map.</p>
                <div className="admin-toggle-row">
                  <div>
                    <div className="admin-toggle-label">Require approval for new members</div>
                    <div className="admin-toggle-hint">New clubs will be hidden until you approve them</div>
                  </div>
                  <ToggleSwitch on={settings.require_approval}
                    onChange={v => setSettings(s => ({ ...s, require_approval: v }))} />
                </div>
              </div>

              {/* Demographics */}
              <div className="admin-section">
                <h3 className="admin-section-title">Demographics — Market Data</h3>
                <p className="admin-section-desc">Control which data categories are visible to members. Members can further customize their own view within what you enable here.</p>

                {[
                  { key: 'demo_population',  label: 'Population',            hint: 'Total population, household count, and average household size for the ZIP code. Higher population means more potential customers walking past your door.' },
                  { key: 'demo_income',      label: 'Income & Economics',    hint: 'Median household income, per capita income, poverty rate, and unemployment rate. Higher income areas tend to support premium nutrition products better.' },
                  { key: 'demo_age_fit',     label: 'Age Fit (18–49)',       hint: 'The percentage of the population aged 18–49 — the core demographic for nutrition clubs. A higher percentage means more of your ideal customers live nearby.' },
                  { key: 'demo_median_age',  label: 'Median Age',            hint: 'The median age of the local population. Useful context alongside the 18–49 age fit percentage to understand the full age profile of an area.' },
                  { key: 'demo_poverty',     label: 'Poverty Rate',          hint: 'The percentage of residents living below the poverty line. Lower poverty rates generally indicate stronger discretionary spending on health products.' },
                  { key: 'demo_competition', label: 'Club Competition',      hint: 'The number of registered nutrition clubs within a 10-mile radius, plus a saturation score. Fewer clubs = more opportunity for your location.' },
                  { key: 'demo_health',      label: 'Health Indicators',     hint: 'CDC PLACES data showing obesity rate, physical inactivity, diabetes, and high blood pressure rates. Higher rates often indicate stronger demand for nutrition interventions.' },
                  { key: 'demo_spending',    label: 'Consumer Spending',     hint: 'Estimated household spending on health, fitness, and food. Higher health spending signals a more receptive market for nutrition products.' },
                  { key: 'demo_growth',      label: 'Population Growth',     hint: 'Whether the local population is growing, stable, or declining. Growing areas represent expanding future customer bases.' },
                  { key: 'demo_commute',     label: 'Commute & Walkability', hint: 'How residents get to work — walking, driving, transit. High foot-traffic and walkable areas tend to drive more spontaneous drop-ins.' },
                  { key: 'demo_competitors', label: 'Nearby Competitors',    hint: 'Gyms, fitness centers, yoga studios, and health food stores from OpenStreetMap. More fitness businesses nearby = more health-conscious population.' },
                ].map(({ key, label, hint }) => (
                  <div className="admin-toggle-row" key={key} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #f4f4f4' }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <div className="admin-toggle-label">{label}</div>
                      <div className="admin-toggle-hint">{hint}</div>
                    </div>
                    <ToggleSwitch on={settings[key] !== false}
                      onChange={v => setSettings(s => ({ ...s, [key]: v }))} />
                  </div>
                ))}
              </div>

              <div className="profile-actions" style={{ marginTop: 8 }}>
                {savedSettings && <span className="save-confirm">✓ Settings saved</span>}
                <button className="btn-save" onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MESSAGES TAB ── */}
      {tab === 'contacts' && (
        <div className="admin-contacts">

          {/* Sub-tabs */}
          <div className="msg-subtabs">
            <button
              className={`msg-subtab ${msgSubTab === 'contact' ? 'active' : ''}`}
              onClick={() => setMsgSubTab('contact')}
            >
              Contact messages
              {unreadContacts > 0 && <span className="msg-unread-badge">{unreadContacts}</span>}
            </button>
            <button
              className={`msg-subtab ${msgSubTab === 'members' ? 'active' : ''}`}
              onClick={() => setMsgSubTab('members')}
            >
              Member activity
              {unreadNotifs > 0 && <span className="msg-unread-badge">{unreadNotifs}</span>}
            </button>
          </div>

          {/* ── Contact messages sub-tab ── */}
          {msgSubTab === 'contact' && (
            <div>
              {unreadContacts > 0 && (
                <div className="msg-mark-all-row">
                  <button className="msg-mark-all-btn" onClick={markAllContactsRead}>
                    Mark all as read
                  </button>
                </div>
              )}
              {loadingContacts ? (
                <div className="admin-loading">Loading messages…</div>
              ) : contacts.length === 0 ? (
                <div className="admin-empty">No contact messages yet.</div>
              ) : (
                <div className="contact-submissions-list">
                  {contacts.map(c => (
                    <div key={c.id} className={`msg-contact-wrap ${!c.is_read ? 'unread' : ''}`}
                      onClick={() => { if (!c.is_read) markContactRead(c.id) }}>
                      {!c.is_read && <div className="msg-unread-dot" />}
                      <ContactCard
                        submission={c}
                        onReplySent={(reply) => {
                          setContacts(prev => prev.map(x =>
                            x.id === c.id
                              ? { ...x, replies: [...(x.replies || []), reply], is_read: true }
                              : x
                          ))
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Member activity sub-tab ── */}
          {msgSubTab === 'members' && (
            <div>
              {unreadNotifs > 0 && (
                <div className="msg-mark-all-row">
                  <button className="msg-mark-all-btn" onClick={markAllNotifsRead}>
                    Mark all as read
                  </button>
                </div>
              )}
              {!notifLoaded ? (
                <div className="admin-loading">Loading activity…</div>
              ) : notifications.length === 0 ? (
                <div className="admin-empty">No member activity yet.</div>
              ) : (
                <div className="notif-list">
                  {notifications.map(n => (
                    <div key={n.id}
                      className={`notif-card ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => { if (!n.is_read) markNotifRead(n.id) }}
                    >
                      {!n.is_read && <div className="msg-unread-dot" />}
                      <div className="notif-icon">
                        {n.type === 'new_signup'   && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#1A3C2E" strokeWidth="1.3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="#1A3C2E" strokeWidth="1.3" strokeLinecap="round"/></svg>}
                        {n.type === 'new_profile'  && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#1A3C2E" strokeWidth="1.3"/><line x1="5" y1="6" x2="11" y2="6" stroke="#1A3C2E" strokeWidth="1.3" strokeLinecap="round"/><line x1="5" y1="9" x2="9" y2="9" stroke="#1A3C2E" strokeWidth="1.3" strokeLinecap="round"/></svg>}
                        {n.type === 'pending_approval' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#F59E0B" strokeWidth="1.3"/><line x1="8" y1="5" x2="8" y2="8.5" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="10.5" r="0.8" fill="#F59E0B"/></svg>}
                      </div>
                      <div className="notif-body">
                        <div className="notif-title">{n.title}</div>
                        {n.body && <div className="notif-text">{n.body}</div>}
                        <div className="notif-time">
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {new Date(n.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                      {n.type === 'pending_approval' && (
                        <button className="notif-action-btn" onClick={e => { e.stopPropagation(); setTab('members') }}>
                          Review →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Welcome preview modal ── */}
      {previewModal && (
        <div className="modal-overlay" onClick={() => setPreviewModal(null)}>
          <div className="modal-card" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="admin-preview-modal-label">
              {previewModal === 'message' ? 'Welcome message preview' : 'Disclaimer preview'} — what users see
            </div>
            <h2 className="modal-title" style={{ fontSize: 18, marginBottom: 12 }}>
              {settings.welcome_title || 'Welcome to My Club Locator!'}
            </h2>
            {settings.welcome_video_enabled && (
              <div className="admin-preview-video-placeholder">
                <span>Video plays here</span>
              </div>
            )}
            <p className="admin-preview-message-text"
              style={{ fontWeight: previewModal === 'message' ? 'normal' : 'normal',
                       border: previewModal === 'message' ? '1.5px solid #1A3C2E' : 'none',
                       background: previewModal === 'message' ? '#f0faf5' : 'transparent' }}>
              {settings.welcome_message || 'Your welcome message will appear here.'}
            </p>
            {settings.welcome_disclaimer && (
              <p className="admin-preview-disclaimer-text"
                style={{ border: previewModal === 'disclaimer' ? '1.5px solid #1A3C2E' : 'none',
                         background: previewModal === 'disclaimer' ? '#f0faf5' : 'transparent' }}>
                {settings.welcome_disclaimer}
              </p>
            )}
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="modal-btn-primary">Add / Manage My Club</button>
              <button className="modal-btn-secondary" onClick={() => setPreviewModal(null)}>Explore the Map</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm remove modal ── */}
      {confirmRemove && (
        <div className="modal-overlay" onClick={() => setConfirmRemove(null)}>
          <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ fontSize: 18 }}>Remove this club?</h2>
            <p className="modal-message">
              This will permanently remove <strong>{confirmRemove.club_name || 'this club'}</strong> from the registry and the map. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="modal-btn-primary" style={{ background: '#e53e3e' }}
                onClick={() => handleRemove(confirmRemove)}
                disabled={actionLoading === confirmRemove.id}>
                {actionLoading === confirmRemove.id ? 'Removing…' : 'Yes, remove permanently'}
              </button>
              <button className="modal-btn-secondary" onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
