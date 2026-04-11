import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TABS = ['members', 'settings', 'contacts']

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
  const [tab, setTab] = useState('members')

  // Members state
  const [members, setMembers]           = useState([])
  const [allUsers, setAllUsers]         = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [searchMember, setSearchMember] = useState('')
  const [filterProfile, setFilterProfile] = useState('all') // all | complete | incomplete
  const [filterApproval, setFilterApproval] = useState('all') // all | approved | pending
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [memberMsg, setMemberMsg]       = useState('')

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
  })
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings]   = useState(false)
  const [savedSettings, setSavedSettings]     = useState(false)

  // Contacts state
  const [contacts, setContacts]           = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsLoaded, setContactsLoaded]   = useState(false)

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
    if (data) setMembers(data)
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
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setContacts(data)
    setLoadingContacts(false)
    setContactsLoaded(true)
  }

  function handleTabChange(t) {
    setTab(t)
    if (t === 'contacts' && !contactsLoaded) loadContacts()
  }

  async function handleApprove(member) {
    setActionLoading(member.id)
    await supabase.from('locations').update({
      approved: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', member.id)
    await loadMembers()
    setMemberMsg(`${member.business_name || 'Club'} approved.`)
    setTimeout(() => setMemberMsg(''), 3000)
    setActionLoading(null)
  }

  async function handleRevoke(member) {
    setActionLoading(member.id)
    await supabase.from('locations').update({ approved: false }).eq('id', member.id)
    await loadMembers()
    setMemberMsg(`${member.business_name || 'Club'} approval revoked.`)
    setTimeout(() => setMemberMsg(''), 3000)
    setActionLoading(null)
  }

  async function handleRemove(member) {
    setActionLoading(member.id)
    await supabase.from('locations').delete().eq('id', member.id)
    await loadMembers()
    setConfirmRemove(null)
    setMemberMsg(`${member.business_name || 'Club'} removed from registry.`)
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
    return !!(m.business_name && m.address && m.city && m.phone &&
      ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
        .some(d => m[`hours_${d}_open`]))
  }

  const filteredMembers = members.filter(m => {
    const q = searchMember.toLowerCase()
    const ownerName = [m.first_name, m.last_name].filter(Boolean).join(' ').toLowerCase()
    const nameMatch = !q || (m.business_name || '').toLowerCase().includes(q) ||
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
            {t === 'members' ? 'Members' : t === 'settings' ? 'Settings' : `Messages ${contacts.length > 0 ? `(${contacts.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <div>
          {/* Stats */}
          <div className="admin-stats-row">
            <StatCard label="Total members" value={totalMembers} />
            <StatCard label="Profile complete" value={completeCount} color="#1A3C2E" />
            <StatCard label="Incomplete" value={totalMembers - completeCount} color="#888" />
            <StatCard label="Pending approval" value={pendingCount} color={pendingCount > 0 ? '#e53e3e' : '#888'} />
          </div>

          {/* Filters */}
          <div className="admin-member-filters">
            <input className="search-input" type="text" placeholder="Search name, city, owner…"
              value={searchMember} onChange={e => setSearchMember(e.target.value)}
              style={{ flex: 1, minWidth: 180 }} />
            <select className="dir-sort" value={filterProfile}
              onChange={e => setFilterProfile(e.target.value)}>
              <option value="all">All profiles</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
            <select className="dir-sort" value={filterApproval}
              onChange={e => setFilterApproval(e.target.value)}>
              <option value="all">All status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {memberMsg && <div className="success-msg" style={{ marginBottom: 12 }}>{memberMsg}</div>}

          {loadingMembers ? (
            <div className="loading">Loading members…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="loading" style={{ height: 80 }}>No members found.</div>
          ) : (
            <div className="admin-member-list">
              {filteredMembers.map(m => {
                const complete   = profileComplete(m)
                const approved   = m.approved !== false
                const ownerName  = [m.first_name, m.last_name].filter(Boolean).join(' ')
                const isLoading  = actionLoading === m.id
                const isMe       = m.user_id === user?.id

                return (
                  <div key={m.id} className={`admin-member-row ${!approved ? 'pending-row' : ''}`}>

                    {/* Left: initials + info */}
                    <div className="amr-left">
                      <div className="amr-initials">
                        {(m.business_name || 'CL').slice(0,2).toUpperCase()}
                      </div>
                      <div className="amr-info">
                        <div className="amr-name">
                          {m.business_name || <span style={{ color: '#aaa' }}>No club name</span>}
                          {isMe && <span className="amr-you-badge">You</span>}
                        </div>
                        {ownerName && <div className="amr-owner">{ownerName}</div>}
                        <div className="amr-meta">
                          {m.city && <span>{m.city}{m.state ? `, ${m.state}` : ''}</span>}
                          {m.created_at && <span>Joined {new Date(m.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Middle: badges */}
                    <div className="amr-badges">
                      <span className={`amr-badge ${complete ? 'badge-complete' : 'badge-incomplete'}`}>
                        {complete ? '✓ Complete' : '⚠ Incomplete'}
                      </span>
                      <span className={`amr-badge ${approved ? 'badge-approved' : 'badge-pending'}`}>
                        {approved ? '✓ Approved' : '⏳ Pending'}
                      </span>
                    </div>

                    {/* Right: actions */}
                    {!isMe && (
                      <div className="amr-actions">
                        {!approved ? (
                          <button className="amr-btn amr-btn-approve" disabled={isLoading}
                            onClick={() => handleApprove(m)}>
                            {isLoading ? '…' : 'Approve'}
                          </button>
                        ) : (
                          <button className="amr-btn amr-btn-revoke" disabled={isLoading}
                            onClick={() => handleRevoke(m)}>
                            {isLoading ? '…' : 'Revoke'}
                          </button>
                        )}
                        <button className="amr-btn amr-btn-remove" disabled={isLoading}
                          onClick={() => setConfirmRemove(m)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
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
                    <label>Welcome message</label>
                    <textarea rows={3} value={settings.welcome_message}
                      onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
                      style={{ resize: 'vertical' }} />
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
                    <label>Disclaimer text <span className="field-optional">shown to all users at bottom of modal</span></label>
                    <textarea rows={3} value={settings.welcome_disclaimer}
                      onChange={e => setSettings(s => ({ ...s, welcome_disclaimer: e.target.value }))}
                      placeholder="Enter your disclaimer here — e.g. terms of use, membership rules, etc."
                      style={{ resize: 'vertical' }} />
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
                <p className="admin-section-desc">Control which data points are visible to members and factor into the market score.</p>

                {[
                  { key: 'demo_population',    label: 'Population',              hint: 'Total population & households' },
                  { key: 'demo_income',         label: 'Income & Economics',      hint: 'Median income, per capita income' },
                  { key: 'demo_age_fit',        label: 'Age Fit (18–49)',         hint: 'Core nutrition club demographic — factors into score' },
                  { key: 'demo_poverty',        label: 'Poverty Rate',            hint: 'Factors into score (lower = better market)' },
                  { key: 'demo_unemployment',   label: 'Unemployment Rate',       hint: 'Shown as context' },
                  { key: 'demo_households',     label: 'Household Data',          hint: 'Household count & average size' },
                  { key: 'demo_competition',    label: 'Club Competition',        hint: 'Nearby clubs, saturation — factors into score' },
                ].map(({ key, label, hint }) => (
                  <div className="admin-toggle-row" key={key} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #f4f4f4' }}>
                    <div>
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

      {/* ── CONTACTS TAB ── */}
      {tab === 'contacts' && (
        <div className="admin-contacts">
          {loadingContacts ? (
            <div className="admin-loading">Loading messages…</div>
          ) : contacts.length === 0 ? (
            <div className="admin-empty">No messages yet.</div>
          ) : (
            <div className="contact-submissions-list">
              {contacts.map(c => (
                <div key={c.id} className="contact-submission-card">
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
                  <a href={`mailto:${c.email}?subject=Re: Your message to My Club Locator`} className="csub-reply-btn">
                    Reply by email →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Confirm remove modal ── */}
      {confirmRemove && (
        <div className="modal-overlay" onClick={() => setConfirmRemove(null)}>
          <div className="modal-card" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ fontSize: 18 }}>Remove this club?</h2>
            <p className="modal-message">
              This will permanently remove <strong>{confirmRemove.business_name || 'this club'}</strong> from the registry and the map. This cannot be undone.
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
