import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import mapPreviewStreets from '../assets/map-preview-streets.png'
import mapPreviewSatellite from '../assets/map-preview-satellite.png'
import RichTextEditor from '../components/RichTextEditor'

const TABS = ['settings', 'access', 'contacts', 'members', 'teams']

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY

// ── Shared color helpers (used by App Theme, Landing Page, Marker Colors) ──
function hexToHsl(hex) {
  if (!hex || hex.length < 7) return [0, 0, 50]
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h, s, l = (max+min)/2
  if (max === min) { h = s = 0 } else {
    const d = max - min; s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break
      case g: h = ((b-r)/d + 2)/6; break
      default: h = ((r-g)/d + 4)/6
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)]
}
function hslToHex(h,s,l) {
  s/=100; l/=100
  const a = s*Math.min(l,1-l)
  const f = n => { const k=(n+h/30)%12; const c=l-a*Math.max(-1,Math.min(k-3,9-k,1)); return Math.round(255*c).toString(16).padStart(2,'0') }
  return `#${f(0)}${f(8)}${f(4)}`
}
function genShades(hex, count = 8) {
  const [h, s] = hexToHsl(hex)
  const stops = count === 8 ? [94,82,68,54,40,28,18,10] : [92,78,62,48,35,22,12]
  return stops.map(l => hslToHex(h, Math.min(s + 8, 100), l))
}

// App Theme picker field definitions
const themeFields = [
  { key: 'theme_page_bg',        label: 'Page background',     desc: 'Background color behind all cards' },
  { key: 'theme_card_header_bg', label: 'Card header',         desc: 'The green band at the top of each card' },
  { key: 'theme_card_body',      label: 'Card body background', desc: 'Inside content area of each card' },
]

// Header text color swatches
const HEADER_TEXT_OPTIONS = [
  { value: '#ffffff',             label: 'White' },
  { value: '#f0f0f0',             label: 'Soft white' },
  { value: '#d4d4d4',             label: 'Light gray' },
  { value: '#a0a0a0',             label: 'Mid gray' },
  { value: '#1a1a1a',             label: 'Near black' },
  { value: '#F5E6C8',             label: 'Warm cream' },
  { value: '#C8F5E6',             label: 'Mint' },
]

function ContactCard({ submission: c, onReplySent, expanded, onToggle }) {
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

  const preview = c.message?.slice(0, 80) + (c.message?.length > 80 ? '…' : '')

  return (
    <div className="contact-submission-card">
      {/* Collapsed header — always visible */}
      <div className="csub-collapse-header" onClick={onToggle}>
        <div className="csub-avatar">{(c.name || '?').slice(0,1).toUpperCase()}</div>
        <div className="csub-meta">
          <div className="csub-name">{c.name}</div>
          <div className="csub-email">{c.email}</div>
        </div>
        {!expanded && <div className="csub-preview">{preview}</div>}
        <div className="csub-collapse-right">
          <div className="csub-date">
            {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {replies.length > 0 && <span className="csub-reply-count">{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>}
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <>
          <div className="csub-message">{c.message}</div>

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
        </>
      )}
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

  // Resizable columns — default widths in px
  const defaultColWidths = [48, 190, 150, 170, 130, 210, 80, 90, 120, 90, 110]
  const [colWidths, setColWidths] = useState(defaultColWidths)
  const resizingCol = useRef(null)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const onResizeMouseDown = useCallback((e, colIdx) => {
    e.preventDefault()
    resizingCol.current = colIdx
    resizeStartX.current = e.clientX
    resizeStartW.current = colWidths[colIdx]
    const onMove = (ev) => {
      const delta = ev.clientX - resizeStartX.current
      setColWidths(prev => {
        const next = [...prev]
        next[resizingCol.current] = Math.max(40, resizeStartW.current + delta)
        return next
      })
    }
    const onUp = () => {
      resizingCol.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Save to database after drag ends
      setColWidths(prev => {
        supabase.from('app_settings').upsert(
          { id: 1, col_widths: JSON.stringify(prev) },
          { onConflict: 'id' }
        )
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

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
    welcome_returning_title: 'Welcome back, {{first_name}}!',
    welcome_message: "You're now part of the network. Watch the video below to get started, then add your club to the map.",
    welcome_disclaimer_enabled: true,
    welcome_disclaimer: '',
    welcome_new_title: 'Welcome to My Club Locator!',
    welcome_new_message: 'Your email is confirmed and your account is active. Watch the quick intro below, then we\'ll walk you through setting up your club.',
    welcome_new_video_enabled: false,
    welcome_new_video_url: '',
    welcome_new_button_text: 'Let\'s get started →',
    require_approval: false,
    member_signups_enabled: true,
    member_login_enabled: true,
    public_search_enabled: true,
    public_accounts_enabled: true,
    public_login_enabled: true,
    login_msg_approved_enabled: true,
    login_msg_approved: 'Welcome back, {name}! {club} is live on the map.',
    login_msg_pending_enabled: true,
    login_msg_pending: "Welcome back, {name}! {club} is pending approval. You'll appear on the map once approved.",
    login_msg_no_profile_enabled: true,
    login_msg_no_profile: "Welcome back! Your club profile isn't set up yet. Finish setting it up to appear on the map.",
    public_finder_welcome: 'Find a nutrition club near you',
    public_finder_disclaimer_enabled: true,
    public_finder_disclaimer: 'This directory is provided for informational purposes only. My Club Locator is not affiliated with or endorsed by Herbalife International. Club hours and availability may vary — contact the club directly to confirm.',
    search_radius_miles: 20,
    team_creation_enabled: true,
    team_creation_min_level: 'Active World Team',
    team_info_modal_enabled: true,
    team_info_message: '<p>Teams let you organize your downline into groups. As a team leader, you can:</p><ul><li>Create a named team and invite club owners to join</li><li>See all your team members\' clubs highlighted on the map</li><li>Track who\'s joined and who\'s pending</li><li>Build a stronger, more connected network</li></ul><p>Your team members can see they belong to your team and find each other on the map. It\'s the easiest way to stay connected with the people in your organization.</p>',
    team_info_video_enabled: false,
    team_info_video_url: '',
    marker_color_own:      '#D94F4F',
    marker_color_other:    '#6B8DD6',
    marker_color_selected: '#F59E0B',
    marker_color_team:     '#7C3AED',
    landing_eyebrow_color: '#F1EFE8',
    landing_hero_panel_color: '#1A3C2E',
    theme_page_bg:          '#E8E3D8',
    theme_card_header_bg:   '#1A3C2E',
    theme_card_header_text: '#ffffff',
    theme_card_header_bold: true,
    theme_card_body:        '#ffffff',
    site_font:              'dm-sans',
    global_marker_shape:    'dot',
    global_marker_size:     'small',
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
  const savedSettingsRef = useRef(null)
  const isSettingsDirty = (() => {
    if (!savedSettingsRef.current) return false
    const saved = savedSettingsRef.current
    const keys = Object.keys(saved)
    return keys.some(k => JSON.stringify(settings[k]) !== JSON.stringify(saved[k]))
  })()
  const [demoOpen, setDemoOpen]               = useState(false)
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false)
  const [loginMsgsOpen, setLoginMsgsOpen]       = useState(false)
  const [card1Open, setCard1Open]               = useState(false)
  const [card2Open, setCard2Open]               = useState(false)
  const [card3Open, setCard3Open]               = useState(false)
  const [finderMsgsOpen, setFinderMsgsOpen]     = useState(false)
  const [finderSearchOpen, setFinderSearchOpen] = useState(false)
  const [markerColorsOpen, setMarkerColorsOpen] = useState(false)
  const [landingOpen, setLandingOpen] = useState(false)
  const [appThemeOpen, setAppThemeOpen] = useState(false)
  const [memberApprovalOpen, setMemberApprovalOpen] = useState(false)
  const [teamCreationOpen, setTeamCreationOpen] = useState(false)
  const [previewBasemap, setPreviewBasemap] = useState('streets')
  const curHeaderTxt = HEADER_TEXT_OPTIONS.find(o => o.value === settings.theme_card_header_text) || { value: settings.theme_card_header_text || '#ffffff', label: 'Custom' }

  // Contacts state
  const [contacts, setContacts]             = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsLoaded, setContactsLoaded]   = useState(false)
  const [expandedContact, setExpandedContact] = useState(null)
  const [notifications, setNotifications]     = useState([])
  const [notifLoaded, setNotifLoaded]         = useState(false)
  const [msgSubTab, setMsgSubTab]             = useState('contact') // 'contact' | 'members' | 'notes'
  const [clubNotes, setClubNotes]             = useState([])
  const [notesLoaded, setNotesLoaded]         = useState(false)
  const [forwardingNoteId, setForwardingNoteId] = useState(null)

  // Teams state
  const [allTeams, setAllTeams]         = useState([])
  const [teamsLoaded, setTeamsLoaded]   = useState(false)

  // Unread counts — per type
  const unreadContacts = contacts.filter(c => !c.is_read).length
  const unreadByType = {}
  notifications.filter(n => !n.is_read).forEach(n => {
    unreadByType[n.type] = (unreadByType[n.type] || 0) + 1
  })
  const unreadNotifs   = Object.values(unreadByType).reduce((a, b) => a + b, 0)
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
    // Subscribe to locations — auto-refresh members table on new/updated clubs
    const locSub = supabase.channel('admin-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
        loadMembers()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(contactSub)
      supabase.removeChannel(notifSub)
      supabase.removeChannel(locSub)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) { navigate('/app/map'); return }
    loadMembers()
    loadSettings()
  }, [isAdmin])

  // Live-apply theme vars as admin changes pickers (for preview on other pages after save)
  // Admin page itself is immune via !important overrides in CSS
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme_page_bg)          root.style.setProperty('--theme-page-bg',          settings.theme_page_bg)
    if (settings.theme_card_header_bg)   root.style.setProperty('--theme-card-header-bg',   settings.theme_card_header_bg)
    if (settings.theme_card_header_text) root.style.setProperty('--theme-card-header-text', settings.theme_card_header_text)
    root.style.setProperty('--theme-card-header-weight', settings.theme_card_header_bold === false ? '400' : '600')
    if (settings.theme_card_body)        root.style.setProperty('--theme-card-body',         settings.theme_card_body)
    const fontMap = {
      'dm-sans': "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      'playfair': "'Playfair Display', Georgia, 'Times New Roman', serif",
      'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }
    root.style.setProperty('--site-font', fontMap[settings.site_font] || fontMap['dm-sans'])
  }, [settings.theme_page_bg, settings.theme_card_header_bg, settings.theme_card_header_text, settings.theme_card_header_bold, settings.theme_card_body, settings.site_font])

  async function loadMembers() {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      // Fill missing person fields from sibling rows (same user_id)
      // Groups by user_id, finds the row with person data, copies to siblings missing it
      const byUser = {}
      data.forEach(m => {
        if (!byUser[m.user_id]) byUser[m.user_id] = []
        byUser[m.user_id].push(m)
      })
      const PERSON_KEYS = ['first_name', 'last_name', 'owner_email', 'herbalife_level',
        'owner2_first_name', 'owner2_last_name', 'owner_photo_url', 'owner2_photo_url', 'owner3_photo_url']
      const idsToFix = []
      Object.values(byUser).forEach(rows => {
        if (rows.length < 2) return
        const source = rows.find(r => r.first_name) || rows[0]
        rows.forEach(r => {
          if (!r.first_name && source.first_name) {
            PERSON_KEYS.forEach(k => { if (source[k] && !r[k]) r[k] = source[k] })
            if (r.id) idsToFix.push({ id: r.id, first_name: source.first_name, last_name: source.last_name })
          }
        })
      })
      // Also fix the DB rows so this is permanent
      for (const fix of idsToFix) {
        const patch = {}
        PERSON_KEYS.forEach(k => {
          const src = byUser[data.find(d => d.id === fix.id)?.user_id]?.find(r => r.first_name)
          if (src && src[k]) patch[k] = src[k]
        })
        if (Object.keys(patch).length > 0) {
          supabase.from('locations').update(patch).eq('id', fix.id).then(() => {})
        }
      }

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
    if (data) {
      const merged = { ...settings, ...data }
      setSettings(merged)
      savedSettingsRef.current = merged
      if (data.col_widths) {
        try {
          const parsed = JSON.parse(data.col_widths)
          // Reset if saved widths have wrong column count or match old narrow defaults
          const oldDefaults1 = [48, 160, 130, 120, 120, 180, 80, 90, 120, 90, 100]
          const oldDefaults2 = [48, 180, 140, 150, 120, 200, 80, 90, 120, 90, 100]
          const str = JSON.stringify(parsed)
          if (parsed.length === defaultColWidths.length && str !== JSON.stringify(oldDefaults1) && str !== JSON.stringify(oldDefaults2)) {
            setColWidths(parsed)
          }
        } catch {}
      }
    }
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
    await supabase.from('contact_submissions').update({ is_read: true }).or('is_read.eq.false,is_read.is.null')
    setContacts(prev => prev.map(c => ({ ...c, is_read: true })))
  }

  async function markAllNotifsRead() {
    await supabase.from('notifications').update({ is_read: true }).or('is_read.eq.false,is_read.is.null')
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function loadClubNotes() {
    const { data } = await supabase
      .from('club_notes')
      .select('*, public_accounts(email, display_name), locations(club_name, club_email, user_id)')
      .order('created_at', { ascending: false })
    if (data) setClubNotes(data)
    setNotesLoaded(true)
  }

  async function forwardNote(note) {
    setForwardingNoteId(note.id)
    const ownerEmail = note.locations?.club_email
    const clubName   = note.locations?.club_name || 'your club'
    const senderName = note.public_accounts?.display_name || note.public_accounts?.email || 'A visitor'

    // Send email to club owner if they have an email
    if (ownerEmail) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'My Club Locator', email: 'hello@myclublocator.com' },
          to: [{ email: ownerEmail }],
          subject: `Someone left a note about ${clubName}`,
          htmlContent: `<p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;">Hi there,</p><p style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333;">A visitor to the My Club Locator public finder left the following note about <strong>${clubName}</strong>:</p><blockquote style="border-left:3px solid #4CAF82;margin:16px 0;padding:12px 16px;background:#f0faf5;font-style:italic;color:#333;">${note.note}</blockquote><p style="font-family:sans-serif;font-size:13px;color:#aaa;">This note was submitted by ${senderName} via the public club finder.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0"/><p style="font-size:12px;color:#aaa;">My Club Locator · hello@myclublocator.com</p>`,
        }),
      })
    }

    // Insert in-app notification for the club owner
    if (note.locations?.user_id) {
      await supabase.from('notifications').insert({
        type: 'club_note',
        title: `New note on ${clubName}`,
        body: `${senderName} left a note: "${note.note.slice(0, 100)}${note.note.length > 100 ? '…' : ''}"`,
        user_id: note.locations.user_id,
      })
    }

    // Mark as forwarded
    await supabase.from('club_notes').update({ forwarded: true }).eq('id', note.id)
    setClubNotes(prev => prev.map(n => n.id === note.id ? { ...n, forwarded: true } : n))
    setForwardingNoteId(null)
  }

  async function loadTeams() {
    const { data } = await supabase
      .from('teams')
      .select('id, name, created_at, owner_user_id, team_members(id, status, location_id, locations(club_name, city, state, user_id, first_name, last_name))')
      .order('created_at', { ascending: false })
    if (data) setAllTeams(data)
    setTeamsLoaded(true)
  }

  async function handleDissolveTeam(teamId) {
    await supabase.from('teams').delete().eq('id', teamId)
    setAllTeams(prev => prev.filter(t => t.id !== teamId))
  }

  async function handleRemoveTeamMember(memberId, teamId) {
    await supabase.from('team_members').delete().eq('id', memberId)
    setAllTeams(prev => prev.map(t => t.id !== teamId ? t : {
      ...t,
      team_members: t.team_members.filter(m => m.id !== memberId)
    }))
  }

  function handleTabChange(t) {
    setTab(t)
    if (t === 'contacts') {
      if (!contactsLoaded) loadContacts()
      if (!notifLoaded) loadNotifications()
      if (!notesLoaded) loadClubNotes()
    }
    if (t === 'teams') {
      if (!teamsLoaded) loadTeams()
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
    const payload = {
      id: 1,
      welcome_video_enabled:      settings.welcome_video_enabled,
      welcome_video_url:          settings.welcome_video_url,
      welcome_video_placeholder:  settings.welcome_video_placeholder,
      welcome_title:              settings.welcome_title,
      welcome_returning_title:    settings.welcome_returning_title,
      welcome_message:            settings.welcome_message,
      welcome_disclaimer_enabled: settings.welcome_disclaimer_enabled,
      welcome_disclaimer:         settings.welcome_disclaimer,
      welcome_new_title:          settings.welcome_new_title,
      welcome_new_message:        settings.welcome_new_message,
      welcome_new_video_enabled:  settings.welcome_new_video_enabled,
      welcome_new_video_url:      settings.welcome_new_video_url,
      welcome_new_button_text:    settings.welcome_new_button_text,
      require_approval:           settings.require_approval,
      member_signups_enabled:     settings.member_signups_enabled,
      member_login_enabled:       settings.member_login_enabled,
      public_search_enabled:      settings.public_search_enabled,
      public_accounts_enabled:    settings.public_accounts_enabled,
      public_login_enabled:       settings.public_login_enabled,
      login_msg_approved_enabled:    settings.login_msg_approved_enabled,
      login_msg_approved:            settings.login_msg_approved,
      login_msg_pending_enabled:     settings.login_msg_pending_enabled,
      login_msg_pending:             settings.login_msg_pending,
      login_msg_no_profile_enabled:  settings.login_msg_no_profile_enabled,
      login_msg_no_profile:          settings.login_msg_no_profile,
      public_finder_welcome:             settings.public_finder_welcome,
      public_finder_disclaimer_enabled:  settings.public_finder_disclaimer_enabled,
      public_finder_disclaimer:          settings.public_finder_disclaimer,
      search_radius_miles:               settings.search_radius_miles,
      team_creation_enabled:             settings.team_creation_enabled,
      team_creation_min_level:           settings.team_creation_min_level,
      team_info_modal_enabled:           settings.team_info_modal_enabled,
      team_info_message:                 settings.team_info_message,
      team_info_video_enabled:           settings.team_info_video_enabled,
      team_info_video_url:               settings.team_info_video_url,
      marker_color_own:                  settings.marker_color_own,
      marker_color_other:                settings.marker_color_other,
      marker_color_selected:             settings.marker_color_selected,
      marker_color_team:                 settings.marker_color_team,
      landing_eyebrow_color:             settings.landing_eyebrow_color || null,
      landing_hero_panel_color:          settings.landing_hero_panel_color || null,
      theme_page_bg:                     settings.theme_page_bg,
      theme_card_header_bg:              settings.theme_card_header_bg,
      theme_card_header_text:            settings.theme_card_header_text,
      theme_card_header_bold:            settings.theme_card_header_bold,
      theme_card_body:                   settings.theme_card_body,
      site_font:                         settings.site_font,
      global_marker_shape:               settings.global_marker_shape,
      global_marker_size:                settings.global_marker_size,
      demo_population:            settings.demo_population,
      demo_income:                settings.demo_income,
      demo_age_fit:               settings.demo_age_fit,
      demo_poverty:               settings.demo_poverty,
      demo_competition:           settings.demo_competition,
      demo_unemployment:          settings.demo_unemployment,
      demo_households:            settings.demo_households,
      demo_median_age:            settings.demo_median_age,
      demo_health:                settings.demo_health,
      demo_spending:              settings.demo_spending,
      demo_growth:                settings.demo_growth,
      demo_commute:               settings.demo_commute,
      demo_competitors:           settings.demo_competitors,
      col_widths:                 JSON.stringify(colWidths),
    }
    const { error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'id' })
    if (error) console.error('Settings save error:', error)
    savedSettingsRef.current = { ...settings }
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
    <div className="admin-page-wrap">
      <div className="profile-header">
        <h2>Admin Panel</h2>
        <p className="profile-sub">Manage members and platform settings.</p>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => {
          const ACCESS_KEYS = ['member_signups_enabled','member_login_enabled','public_search_enabled','public_accounts_enabled','public_login_enabled']
          const anyPaused = ACCESS_KEYS.some(k => settings[k] === false)
          return (
            <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`}
              onClick={() => handleTabChange(t)}>
              {t === 'members' ? 'Members'
                : t === 'settings' ? 'Settings'
                : t === 'teams' ? 'Teams'
                : t === 'access' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Access Controls
                    {anyPaused && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#F59E0B', display: 'inline-block', flexShrink: 0
                      }} />
                    )}
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    Messages
                    {unreadContacts > 0 && (
                      <span title="Unread contact form submissions" style={{
                        background: '#7C3AED', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadContacts}</span>
                    )}
                    {unreadByType.new_signup > 0 && (
                      <span title="New member signups" style={{
                        background: '#2563EB', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.new_signup}</span>
                    )}
                    {unreadByType.new_profile > 0 && (
                      <span title="New club profiles submitted" style={{
                        background: '#059669', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.new_profile}</span>
                    )}
                    {unreadByType.pending_approval > 0 && (
                      <span title="Members awaiting approval" style={{
                        background: '#F59E0B', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.pending_approval}</span>
                    )}
                    {unreadByType.club_note > 0 && (
                      <span title="Notes left by public visitors" style={{
                        background: '#e53e3e', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.club_note}</span>
                    )}
                    {unreadByType.team_invite > 0 && (
                      <span title="Team invitation activity" style={{
                        background: '#0891B2', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.team_invite}</span>
                    )}
                    {unreadByType.team_created > 0 && (
                      <span title="New teams formed" style={{
                        background: '#7C3AED', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.team_created}</span>
                    )}
                    {unreadByType.team_joined > 0 && (
                      <span title="Members joined teams" style={{
                        background: '#0D9488', color: '#fff', borderRadius: '10px',
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', lineHeight: '16px'
                      }}>{unreadByType.team_joined}</span>
                    )}
                  </span>
                )
              }
            </button>
          )
        })}
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
            <input className="search-input" type="text" name="member-search" placeholder="Search name, city, owner…"
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
                        <div className="amt-detail-sub">{ownerName}
                          {m.herbalife_level && (
                            <span className="amt-level-badge">
                              {m.herbalife_level.includes(' 💎')
                                ? <>{m.herbalife_level.replace(/ (\d+) 💎$/, (_, d) => ` ${d} `)}<span style={{ fontSize: 10 }}>💎</span></>
                                : m.herbalife_level
                              }
                            </span>
                          )}
                        </div>
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
                  <table className="amt-table" style={{ tableLayout: 'fixed', width: colWidths.reduce((a,b) => a+b, 0) }}>
                    <colgroup>
                      {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        {['Logo','Club name','Owner','City / State','Phone','Email','Opened','Hours','Status','Joined','Actions'].map((label, i) => (
                          <th key={i} style={{ position: 'relative', userSelect: 'none' }}>
                            {label}
                            <span
                              className="amt-col-resizer"
                              onMouseDown={e => onResizeMouseDown(e, i)}
                            />
                          </th>
                        ))}
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

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div>
          {loadingSettings ? <div className="loading">Loading settings…</div> : (
            <>
              <div className="admin-section" style={{ padding: 0, overflow: "hidden" }}>
                <button type="button" className="survey-toggle-btn" style={{ padding: "14px 20px" }} onClick={() => setCard1Open(o => !o)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>Welcome Messages, Member Approval, and Teams</h3>
                  </div>
                  <svg className={`survey-chevron ${card1Open ? "open" : ""}`} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {card1Open && (
                  <div className="admin-card-body" style={{ padding: '12px 0 0' }}>

                    {/* ═══ 1. Returning Member Welcome ═══ */}
                    <div className="au-card">
                      <div className="au-card-hdr">
                        <div className="au-card-hdr-left">
                          <div className="au-card-icon" style={{ background: '#E1F5EE' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke="#0F6E56" strokeWidth="1.5"/></svg>
                          </div>
                          <div>
                            <div className="au-card-title">Returning member welcome</div>
                            <div className="au-card-where">Modal shown on login to members with a club</div>
                          </div>
                        </div>
                      </div>
                      <div className="au-card-body-grid">
                        <div className="au-card-edit">
                          <div className="au-field"><label>New member title</label>
                            <input type="text" value={settings.welcome_title} onChange={e => setSettings(s => ({ ...s, welcome_title: e.target.value }))} placeholder="Welcome to My Club Locator!" /></div>
                          <div className="au-field"><label>Returning member title <span className="field-optional">for users who already have a club</span></label>
                            <input type="text" value={settings.welcome_returning_title} onChange={e => setSettings(s => ({ ...s, welcome_returning_title: e.target.value }))} placeholder="Welcome back, {{first_name}}!" /></div>
                          <div className="au-field"><label>Message (rich text)</label>
                            <RichTextEditor value={settings.welcome_message} onChange={v => setSettings(s => ({ ...s, welcome_message: v }))} placeholder="Welcome message body…" /></div>
                          <div className="au-toggle-row">
                            <span className="au-toggle-label">Video embed</span>
                            <ToggleSwitch on={settings.welcome_video_enabled} onChange={v => setSettings(s => ({ ...s, welcome_video_enabled: v }))} />
                          </div>
                          {settings.welcome_video_enabled && (
                            <>
                              <div className="au-field"><label>Video URL</label>
                                <input type="url" value={settings.welcome_video_url} onChange={e => setSettings(s => ({ ...s, welcome_video_url: e.target.value }))} placeholder="https://youtube.com/embed/..." /></div>
                              <div className="au-field"><label>Placeholder image URL <span className="field-optional">shown before video loads</span></label>
                                <input type="url" value={settings.welcome_video_placeholder} onChange={e => setSettings(s => ({ ...s, welcome_video_placeholder: e.target.value }))} placeholder="https://..." /></div>
                            </>
                          )}
                          <div className="au-toggle-row">
                            <span className="au-toggle-label">Disclaimer</span>
                            <ToggleSwitch on={settings.welcome_disclaimer_enabled} onChange={v => setSettings(s => ({ ...s, welcome_disclaimer_enabled: v }))} />
                          </div>
                          {settings.welcome_disclaimer_enabled && (
                            <div className="au-field"><label>Disclaimer text (rich text)</label>
                              <RichTextEditor value={settings.welcome_disclaimer} onChange={v => setSettings(s => ({ ...s, welcome_disclaimer: v }))} placeholder="Disclaimer text…" /></div>
                          )}
                        </div>
                        <div className="au-card-preview">
                          <div className="au-preview-label">Live preview</div>
                          <div className="au-preview-modal">
                            <div className="au-preview-logo">
                              <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </div>
                            <div className="au-preview-title">{settings.welcome_returning_title?.replace('{{first_name}}', 'Jeffrey') || 'Welcome back!'}</div>
                            <div className="au-preview-msg rte-content" dangerouslySetInnerHTML={{ __html: settings.welcome_message || 'Your welcome message here.' }} />
                            {settings.welcome_video_enabled && (
                              <div className="au-preview-video"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#ccc"/></svg></div>
                            )}
                            <div className="au-preview-btn">Explore the Map</div>
                            {settings.welcome_disclaimer_enabled && (
                              <div className="au-preview-disc rte-content" dangerouslySetInnerHTML={{ __html: settings.welcome_disclaimer || 'Disclaimer text here.' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ═══ 2. New User Welcome Screen ═══ */}
                    <div className="au-card">
                      <div className="au-card-hdr">
                        <div className="au-card-hdr-left">
                          <div className="au-card-icon" style={{ background: '#E6F1FB' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#185FA5" strokeWidth="1.5"/><circle cx="8.5" cy="7" r="4" stroke="#185FA5" strokeWidth="1.5"/><path d="M20 8v6M23 11h-6" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                          <div>
                            <div className="au-card-title">New user welcome screen</div>
                            <div className="au-card-where">Shown after email confirmation</div>
                          </div>
                        </div>
                      </div>
                      <div className="au-card-body-grid">
                        <div className="au-card-edit">
                          <div className="au-field"><label>Title</label>
                            <input type="text" value={settings.welcome_new_title} onChange={e => setSettings(s => ({ ...s, welcome_new_title: e.target.value }))} placeholder="Welcome to My Club Locator!" /></div>
                          <div className="au-field"><label>Message</label>
                            <textarea rows={3} value={settings.welcome_new_message} onChange={e => setSettings(s => ({ ...s, welcome_new_message: e.target.value }))} placeholder="Your account is active…" /></div>
                          <div className="au-toggle-row">
                            <span className="au-toggle-label">Video embed</span>
                            <ToggleSwitch on={settings.welcome_new_video_enabled} onChange={v => setSettings(s => ({ ...s, welcome_new_video_enabled: v }))} />
                          </div>
                          {settings.welcome_new_video_enabled && (
                            <div className="au-field"><label>Video URL</label>
                              <input type="url" value={settings.welcome_new_video_url} onChange={e => setSettings(s => ({ ...s, welcome_new_video_url: e.target.value }))} placeholder="https://youtube.com/embed/..." /></div>
                          )}
                          <div className="au-field"><label>Button text</label>
                            <input type="text" value={settings.welcome_new_button_text} onChange={e => setSettings(s => ({ ...s, welcome_new_button_text: e.target.value }))} placeholder="Let's get started →" /></div>
                        </div>
                        <div className="au-card-preview">
                          <div className="au-preview-label">Live preview</div>
                          <div className="au-preview-modal">
                            <div className="au-preview-logo">
                              <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            </div>
                            <div className="au-preview-title">{settings.welcome_new_title || 'Welcome!'}</div>
                            <div className="au-preview-msg">{settings.welcome_new_message || 'Your account is active.'}</div>
                            {settings.welcome_new_video_enabled && (
                              <div className="au-preview-video"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#ccc"/></svg></div>
                            )}
                            <div className="au-preview-btn">{settings.welcome_new_button_text || "Let's get started →"}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ═══ 3. Login Messages ═══ */}
                    <div className="au-card">
                      <div className="au-card-hdr">
                        <div className="au-card-hdr-left">
                          <div className="au-card-icon" style={{ background: '#FAEEDA' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6M10 14L21 3M9 7H3v14h14v-6" stroke="#854F0B" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                          <div>
                            <div className="au-card-title">Login messages</div>
                            <div className="au-card-where">Flash message shown after sign-in</div>
                          </div>
                        </div>
                      </div>
                      <div className="au-card-body-grid">
                        <div className="au-card-edit">
                          <div className="au-login-msg-row">
                            <div className="au-login-msg-hdr"><label>Approved members</label><ToggleSwitch on={settings.login_msg_approved_enabled} onChange={v => setSettings(s => ({ ...s, login_msg_approved_enabled: v }))} /></div>
                            {settings.login_msg_approved_enabled && <input type="text" value={settings.login_msg_approved} onChange={e => setSettings(s => ({ ...s, login_msg_approved: e.target.value }))} />}
                          </div>
                          <div className="au-login-msg-row">
                            <div className="au-login-msg-hdr"><label>Pending members</label><ToggleSwitch on={settings.login_msg_pending_enabled} onChange={v => setSettings(s => ({ ...s, login_msg_pending_enabled: v }))} /></div>
                            {settings.login_msg_pending_enabled && <input type="text" value={settings.login_msg_pending} onChange={e => setSettings(s => ({ ...s, login_msg_pending: e.target.value }))} />}
                          </div>
                          <div className="au-login-msg-row" style={{ borderBottom: 'none' }}>
                            <div className="au-login-msg-hdr"><label>No profile yet</label><ToggleSwitch on={settings.login_msg_no_profile_enabled} onChange={v => setSettings(s => ({ ...s, login_msg_no_profile_enabled: v }))} /></div>
                            {settings.login_msg_no_profile_enabled && <input type="text" value={settings.login_msg_no_profile} onChange={e => setSettings(s => ({ ...s, login_msg_no_profile: e.target.value }))} />}
                          </div>
                        </div>
                        <div className="au-card-preview">
                          <div className="au-preview-label">Live preview (approved)</div>
                          <div className="au-preview-modal" style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                              <div className="au-preview-msg" style={{ margin: 0 }}>{(settings.login_msg_approved || '').replace('{name}', 'Jeffrey').replace('{club}', 'Test Club')}</div>
                            </div>
                            <div className="au-preview-btn" style={{ display: 'inline-block' }}>Go to map</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ═══ 4. Team Info Modal ═══ */}
                    <div className="au-card">
                      <div className="au-card-hdr">
                        <div className="au-card-hdr-left">
                          <div className="au-card-icon" style={{ background: '#EEEDFE' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#534AB7" strokeWidth="1.5"/><circle cx="9" cy="7" r="4" stroke="#534AB7" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                          <div>
                            <div className="au-card-title">Team info modal</div>
                            <div className="au-card-where">Shown when user opens teams section</div>
                          </div>
                        </div>
                        <ToggleSwitch on={settings.team_info_modal_enabled} onChange={v => setSettings(s => ({ ...s, team_info_modal_enabled: v }))} />
                      </div>
                      {settings.team_info_modal_enabled && (
                        <div className="au-card-body-grid">
                          <div className="au-card-edit">
                            <div className="au-field"><label>Message (rich text)</label>
                              <RichTextEditor value={settings.team_info_message} onChange={v => setSettings(s => ({ ...s, team_info_message: v }))} placeholder="Explain what teams are…" /></div>
                            <div className="au-toggle-row">
                              <span className="au-toggle-label">Video embed</span>
                              <ToggleSwitch on={settings.team_info_video_enabled} onChange={v => setSettings(s => ({ ...s, team_info_video_enabled: v }))} />
                            </div>
                            {settings.team_info_video_enabled && (
                              <div className="au-field"><label>Video URL</label>
                                <input type="url" value={settings.team_info_video_url} onChange={e => setSettings(s => ({ ...s, team_info_video_url: e.target.value }))} placeholder="https://youtube.com/embed/..." /></div>
                            )}
                          </div>
                          <div className="au-card-preview">
                            <div className="au-preview-label">Live preview</div>
                            <div className="au-preview-modal">
                              <div className="au-preview-title">About teams</div>
                              <div className="au-preview-msg rte-content" dangerouslySetInnerHTML={{ __html: settings.team_info_message || 'Team info message here.' }} />
                              {settings.team_info_video_enabled && (
                                <div className="au-preview-video"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" fill="#ccc"/></svg></div>
                              )}
                              <div className="au-preview-btn">Got it</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ═══ 5. Teams & Approval Settings ═══ */}
                    <div className="au-card">
                      <div className="au-card-hdr">
                        <div className="au-card-hdr-left">
                          <div className="au-card-icon" style={{ background: '#F1EFE8' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#5F5E5A" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#5F5E5A" strokeWidth="1.5"/></svg>
                          </div>
                          <div>
                            <div className="au-card-title">Teams & approval</div>
                            <div className="au-card-where">Team creation rules and member approval</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '12px 16px' }}>
                        <div className="au-toggle-row">
                          <span className="au-toggle-label">Enable team creation</span>
                          <ToggleSwitch on={settings.team_creation_enabled} onChange={v => setSettings(s => ({ ...s, team_creation_enabled: v }))} />
                        </div>
                        {settings.team_creation_enabled && (
                          <div className="au-field" style={{ marginTop: 8 }}><label>Minimum level to create a team</label>
                            <select value={settings.team_creation_min_level} onChange={e => setSettings(s => ({ ...s, team_creation_min_level: e.target.value }))}>
                              {['Distributor','Success Builder','Supervisor','World Team','Active World Team','Get Team','Millionaire Team','Presidents Team','Chairmans Club','Founders Circle'].map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="au-toggle-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f0f0' }}>
                          <span className="au-toggle-label">Require approval for new members</span>
                          <ToggleSwitch on={settings.require_approval} onChange={v => setSettings(s => ({ ...s, require_approval: v }))} />
                        </div>
                        <div className="au-toggle-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f0f0' }}>
                          <span className="au-toggle-label">Enable member signups</span>
                          <ToggleSwitch on={settings.member_signups_enabled !== false} onChange={v => setSettings(s => ({ ...s, member_signups_enabled: v }))} />
                        </div>
                        <div className="au-toggle-row" style={{ marginTop: 8 }}>
                          <span className="au-toggle-label">Enable member login</span>
                          <ToggleSwitch on={settings.member_login_enabled !== false} onChange={v => setSettings(s => ({ ...s, member_login_enabled: v }))} />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div className="admin-section" style={{ padding: 0, overflow: "hidden" }}>
                <button type="button" className="survey-toggle-btn" style={{ padding: "14px 20px" }} onClick={() => setCard2Open(o => !o)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>Public Finder Settings</h3>
                    <span style={{ fontSize: 12, color: 'var(--theme-card-header-text, #888)', opacity: 0.75 }}>{settings.search_radius_miles === 0 ? 'Custom' : settings.search_radius_miles + ' mi radius'}</span>
                  </div>
                  <svg className={`survey-chevron ${card2Open ? "open" : ""}`} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {card2Open && (
                  <div className="admin-card-body">
                    <p className="admin-section-desc" style={{ marginBottom: 16 }}>Customize what public visitors see on the club finder page before and during their search. These are the people looking for a club — not club owners.</p>

                    {/* Welcome heading */}
                    <div className="field" style={{ marginBottom: 16 }}>
                      <label>Finder page heading</label>
                      <input
                        type="text"
                        value={settings.public_finder_welcome}
                        onChange={e => setSettings(s => ({ ...s, public_finder_welcome: e.target.value }))}
                        placeholder="Find a nutrition club near you"
                      />
                      <span className="field-hint">Shown as the main heading on the public search page</span>
                    </div>

                    {/* Disclaimer */}
                    <div className="login-msg-block">
                      <div className="login-msg-header">
                        <div className="login-msg-label-wrap">
                          <span className="login-msg-dot" style={{ background: '#854F0B' }} />
                          <span className="admin-toggle-label">Disclaimer / acknowledgement</span>
                        </div>
                        <ToggleSwitch
                          on={settings.public_finder_disclaimer_enabled}
                          onChange={v => setSettings(s => ({ ...s, public_finder_disclaimer_enabled: v }))}
                        />
                      </div>
                      <div className="login-msg-audience" style={{ borderLeftColor: '#854F0B', background: '#FEF3C7' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="8" cy="8" r="6.5" stroke="#854F0B" strokeWidth="1.2"/>
                          <circle cx="8" cy="5.5" r="1" fill="#854F0B"/>
                          <line x1="8" y1="8" x2="8" y2="11.5" stroke="#854F0B" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                        <span style={{ color: '#854F0B' }}>Shown to every public visitor before they can search. They must tap "I understand" to proceed. Use this for legal disclaimers, terms of use, or any notice you want visitors to acknowledge.</span>
                      </div>
                      {settings.public_finder_disclaimer_enabled && (
                        <div style={{ marginTop: 8 }}>
                          <RichTextEditor
                            value={settings.public_finder_disclaimer}
                            onChange={v => setSettings(s => ({ ...s, public_finder_disclaimer: v }))}
                            placeholder="This directory is provided for informational purposes only..."
                            minHeight={120}
                          />
                        </div>
                      )}
                    </div>

                <div style={{ borderTop: "0.5px solid #e8ede9", padding: "12px 20px 4px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#aaa" }}>Search Radius</div>
                </div>
                    <p className="admin-section-desc" style={{ marginBottom: 16 }}>Controls how far from the searched location clubs are returned. Only clubs within this radius will be sent to the browser — locations outside this range are never exposed.</p>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#333', display: 'block', marginBottom: 10 }}>Search radius</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[10, 20, 30, 40, 50].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setSettings(s => ({ ...s, search_radius_miles: r }))}
                          style={{
                            padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1px solid',
                            background: settings.search_radius_miles === r ? '#1A3C2E' : '#fff',
                            color: settings.search_radius_miles === r ? '#fff' : '#444',
                            borderColor: settings.search_radius_miles === r ? '#1A3C2E' : '#d0d0d0',
                            fontWeight: settings.search_radius_miles === r ? 500 : 400,
                          }}
                        >{r} mi</button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, search_radius_miles: 0 }))}
                        style={{
                          padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1px solid',
                          background: settings.search_radius_miles === 0 ? '#1A3C2E' : '#fff',
                          color: settings.search_radius_miles === 0 ? '#fff' : '#444',
                          borderColor: settings.search_radius_miles === 0 ? '#1A3C2E' : '#d0d0d0',
                          fontWeight: settings.search_radius_miles === 0 ? 500 : 400,
                        }}
                      >Custom</button>
                    </div>
                    {settings.search_radius_miles === 0 && (
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="number"
                          min={1} max={500}
                          placeholder="Enter miles"
                          style={{ width: 120, padding: '6px 10px', fontSize: 13, border: '1px solid #d0d0d0', borderRadius: 8 }}
                          onChange={e => {
                            const v = parseInt(e.target.value)
                            if (v > 0) setSettings(s => ({ ...s, search_radius_miles: -v }))
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#888' }}>miles</span>
                      </div>
                    )}
                    <p style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
                      If no clubs are found within this radius, the nearest 5 will be shown regardless of distance, with a notice to the user.
                    </p>
                  </div>
                )}
              </div>

              <div className="admin-section" style={{ padding: 0 }}>
                <button type="button" className="survey-toggle-btn" style={{ padding: "14px 20px" }} onClick={() => setCard3Open(o => !o)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <h3 className="admin-section-title" style={{ margin: 0 }}>MyClubLocator Themes</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[settings.theme_card_header_bg, settings.theme_page_bg, settings.marker_color_own].map((c, i) => (
                        <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c || '#888', border: '1px solid rgba(0,0,0,0.1)', display: 'inline-block' }} />
                      ))}
                    </div>
                  </div>
                  <svg className={`survey-chevron ${card3Open ? "open" : ""}`} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {card3Open && (
                  <div className="admin-card-body">
                {/* App Theme */}
                <div style={{ borderTop: "0.5px solid #e8ede9", padding: "12px 20px 4px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#aaa", marginBottom: 12 }}>App Theme</div>
                </div>
                        <p className="admin-section-desc" style={{ marginBottom: 18 }}>Customize the page background and card colors across the entire app. Changes preview live as you click.</p>

                        {/* Live mini-preview */}
                        <div style={{ marginBottom: 22 }}>
                          <div className="mc-preview-label" style={{ marginBottom: 8 }}>Preview</div>
                          <div style={{ background: settings.theme_page_bg || '#E8E3D8', borderRadius: 10, padding: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
                            <div style={{ background: settings.theme_card_body || '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                              <div style={{ background: settings.theme_card_header_bg || '#1A3C2E', padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: settings.theme_card_header_text || '#fff' }}>Card Title</span>
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke={settings.theme_card_header_text || '#fff'} strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                              <div style={{ padding: '10px 14px' }}>
                                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Card body content appears here with your chosen background.</div>
                                <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, marginBottom: 5, width: '75%' }} />
                                <div style={{ height: 8, background: 'rgba(0,0,0,0.04)', borderRadius: 4, width: '55%' }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RGB pickers with dynamic shades */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
                          {themeFields.map(({ key, label, desc }) => (
                            <div key={key}>
                              <div className="mc-picker-label" style={{ marginBottom: 4 }}>{label}</div>
                              <div className="admin-section-desc" style={{ marginBottom: 10 }}>{desc}</div>
                              <div className="mc-custom-row" style={{ marginBottom: 10 }}>
                                <input type="color" className="mc-color-input"
                                  value={settings[key] || '#888888'}
                                  onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} />
                                <span className="mc-hex-value">{settings[key]}</span>
                                <div className="mc-current-dot" style={{ background: settings[key] }} />
                              </div>
                              <div className="mc-presets">
                                {genShades(settings[key] || '#888888').map(c => (
                                  <button key={c} className={`mc-preset-swatch ${settings[key] === c ? 'active' : ''}`}
                                    style={{ background: c }} onClick={() => setSettings(s => ({ ...s, [key]: c }))} title={c} />
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* Card header text — Aa swatches + bold toggle */}
                          <div>
                            <div className="mc-picker-label" style={{ marginBottom: 4 }}>Card header text</div>
                            <div className="admin-section-desc" style={{ marginBottom: 10 }}>Title text color and weight inside the header band</div>
                            <div className="mc-custom-row" style={{ marginBottom: 10 }}>
                              <input type="color" className="mc-color-input"
                                value={settings.theme_card_header_text || '#ffffff'}
                                onChange={e => setSettings(s => ({ ...s, theme_card_header_text: e.target.value }))} />
                              <span className="mc-hex-value">{settings.theme_card_header_text}</span>
                              <div className="mc-current-dot" style={{ background: settings.theme_card_header_text }} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                              {HEADER_TEXT_OPTIONS.map(opt => (
                                <button key={opt.value} title={opt.label}
                                  onClick={() => setSettings(s => ({ ...s, theme_card_header_text: opt.value }))}
                                  style={{ width: 34, height: 34, borderRadius: 7, background: settings.theme_card_header_bg || '#1A3C2E', border: settings.theme_card_header_text === opt.value ? '2.5px solid #4CAF82' : '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s', transform: settings.theme_card_header_text === opt.value ? 'scale(1.15)' : 'scale(1)', flexShrink: 0 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: opt.value, lineHeight: 1 }}>Aa</span>
                                </button>
                              ))}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11, color: '#888', marginBottom: 10 }}>{curHeaderTxt.label}</div>
                            {/* Bold toggle */}
                            <div style={{ display: 'flex', gap: 6 }}>
                              {[
                                { val: true,  label: 'Bold',   weight: 600 },
                                { val: false, label: 'Normal', weight: 400 },
                              ].map(({ val, label, weight }) => (
                                <button key={label} type="button"
                                  onClick={() => setSettings(s => ({ ...s, theme_card_header_bold: val }))}
                                  style={{
                                    padding: '5px 14px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
                                    fontWeight: weight,
                                    background: settings.theme_card_header_bold === val || (val === true && settings.theme_card_header_bold === undefined) ? settings.theme_card_header_bg || '#1A3C2E' : '#f4f4f4',
                                    color: settings.theme_card_header_bold === val || (val === true && settings.theme_card_header_bold === undefined) ? settings.theme_card_header_text || '#fff' : '#666',
                                    border: settings.theme_card_header_bold === val || (val === true && settings.theme_card_header_bold === undefined) ? `1.5px solid ${settings.theme_card_header_bg || '#1A3C2E'}` : '1.5px solid #ddd',
                                    transition: 'all 0.12s',
                                  }}
                                >{label}</button>
                              ))}
                            </div>
                          </div>
                        </div>

                {/* Site Font */}
                <div style={{ borderTop: "0.5px solid #e8ede9", padding: "12px 20px 4px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#aaa", marginBottom: 12 }}>Site Font</div>
                </div>
                        <p className="admin-section-desc" style={{ marginBottom: 14 }}>Choose the primary font used across the entire app — all pages, cards, labels, and buttons.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                          {[
                            { value: 'dm-sans', label: 'DM Sans', family: "'DM Sans', sans-serif", desc: 'Clean, modern geometric sans-serif' },
                            { value: 'playfair', label: 'Playfair Display', family: "'Playfair Display', Georgia, serif", desc: 'Elegant editorial serif' },
                            { value: 'system', label: 'System Default', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", desc: 'Uses the device native font' },
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '12px 16px', borderRadius: 10,
                                border: (settings.site_font || 'dm-sans') === opt.value ? '2px solid #1A3C2E' : '1.5px solid #e0e0e0',
                                background: (settings.site_font || 'dm-sans') === opt.value ? '#F0FAF4' : '#fff',
                                cursor: 'pointer', textAlign: 'left', width: '100%',
                                transition: 'border-color 0.15s, background 0.15s',
                              }}
                              onClick={() => setSettings(s => ({ ...s, site_font: opt.value }))}
                            >
                              <span style={{
                                fontFamily: opt.family,
                                fontSize: 22, fontWeight: 600,
                                color: '#1A3C2E', lineHeight: 1,
                                width: 36, textAlign: 'center', flexShrink: 0,
                              }}>Aa</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: opt.family, fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 2 }}>{opt.label}</div>
                                <div style={{ fontSize: 11.5, color: '#999' }}>{opt.desc}</div>
                              </div>
                              {(settings.site_font || 'dm-sans') === opt.value && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1A3C2E"/><path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              )}
                            </button>
                          ))}
                        </div>
                        <div style={{ background: '#f8faf9', borderRadius: 10, padding: '14px 16px', marginBottom: 20, border: '1px solid #e8ede8' }}>
                          <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, fontWeight: 600 }}>Preview</div>
                          <div style={{ fontFamily: settings.site_font === 'playfair' ? "'Playfair Display', Georgia, serif" : settings.site_font === 'system' ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "'DM Sans', sans-serif" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#1A3C2E', marginBottom: 4 }}>My Club Locator</div>
                            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>The quick brown fox jumps over the lazy dog. 0123456789</div>
                          </div>
                        </div>



                <div style={{ borderTop: "0.5px solid #e8ede9", padding: "12px 20px 4px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#aaa" }}>Map Marker Colors</div>
                </div>
                    <p className="admin-section-desc" style={{ marginBottom: 16 }}>Customize the color of each marker type on the map. Changes take effect immediately after saving.</p>

                    {/* Global marker shape picker */}
                    <div style={{ marginBottom: 18 }}>
                      <div className="mc-picker-label" style={{ marginBottom: 4 }}>Default marker shape</div>
                      <div className="admin-section-desc" style={{ marginBottom: 10 }}>Sets the default shape for all owners. Each owner can override this in their map settings.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { val: 'dot',     label: 'Dot',     svgPath: <circle cx="12" cy="12" r="9" fill="currentColor"/> },
                          { val: 'pin',     label: 'Pin',     svgPath: <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/> },
                          { val: 'diamond', label: 'Diamond', svgPath: <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" transform="rotate(45 12 12)"/> },
                        ].map(({ val, label, svgPath }) => {
                          const active = (settings.global_marker_shape || 'dot') === val
                          return (
                            <button key={val} type="button"
                              onClick={() => setSettings(s => ({ ...s, global_marker_shape: val }))}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                                background: active ? '#f0f7f3' : '#fafafa',
                                border: active ? '2px solid #1A3C2E' : '1.5px solid #ddd',
                                color: active ? '#1A3C2E' : '#888',
                                transition: 'all 0.12s', minWidth: 68,
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24">{svgPath}</svg>
                              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Global marker size picker */}
                    <div style={{ marginBottom: 18 }}>
                      <div className="mc-picker-label" style={{ marginBottom: 4 }}>Default marker size</div>
                      <div className="admin-section-desc" style={{ marginBottom: 10 }}>Controls how large markers appear on the map for all users.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { val: 'small',  label: 'Small',  dotSize: 10 },
                          { val: 'medium', label: 'Medium', dotSize: 14 },
                          { val: 'large',  label: 'Large',  dotSize: 19 },
                        ].map(({ val, label, dotSize }) => {
                          const active = (settings.global_marker_size || 'small') === val
                          return (
                            <button key={val} type="button"
                              onClick={() => setSettings(s => ({ ...s, global_marker_size: val }))}
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                                background: active ? '#f0f7f3' : '#fafafa',
                                border: active ? '2px solid #1A3C2E' : '1.5px solid #ddd',
                                color: active ? '#1A3C2E' : '#888',
                                transition: 'all 0.12s', minWidth: 68,
                              }}
                            >
                              <svg width="24" height="24" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r={dotSize / 2} fill="currentColor" opacity="0.7"/>
                              </svg>
                              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Live preview */}
                    <div className="mc-preview-wrap">
                      <div className="mc-preview-label-row">
                        <div className="mc-preview-label">Preview</div>
                        <div className="mc-basemap-toggle">
                          <button className={`mc-basemap-btn ${previewBasemap === 'streets' ? 'active' : ''}`} onClick={() => setPreviewBasemap('streets')}>Map</button>
                          <button className={`mc-basemap-btn ${previewBasemap === 'satellite' ? 'active' : ''}`} onClick={() => setPreviewBasemap('satellite')}>Satellite</button>
                        </div>
                      </div>
                      <div className="mc-preview-map">
                        <div className="mc-map-bg" style={{ backgroundImage: `url(${previewBasemap === 'streets' ? mapPreviewStreets : mapPreviewSatellite})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        {/* Markers — shape-aware SVG */}
                        {(() => {
                          const sizeScale = settings.global_marker_size === 'large' ? 1.5 : settings.global_marker_size === 'medium' ? 1.25 : 1
                          return [
                          { label: 'My club',    color: settings.marker_color_own,      x: '28%', y: '35%', size: Math.round(22 * sizeScale), pulse: true },
                          { label: 'Other club',  color: settings.marker_color_other,    x: '58%', y: '55%', size: Math.round(18 * sizeScale), pulse: false },
                          { label: 'Other club',  color: settings.marker_color_other,    x: '78%', y: '32%', size: Math.round(18 * sizeScale), pulse: false },
                          { label: 'Team club',   color: settings.marker_color_team,     x: '45%', y: '70%', size: Math.round(20 * sizeScale), pulse: true },
                          { label: 'Selected',    color: settings.marker_color_selected, x: '68%', y: '25%', size: Math.round(26 * sizeScale), pulse: false, ring: true },
                        ].map(({ label, color, x, y, size, pulse, ring }, i) => {
                          const shape = settings.global_marker_shape || 'dot'
                          const r = size / 2
                          const pinH = Math.round(size * 1.33)
                          const markerSvg = shape === 'pin'
                            ? <svg width={size} height={pinH} viewBox="0 0 24 32" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                                <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={color} stroke="white" strokeWidth="1.5"/>
                                <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.92"/>
                              </svg>
                            : shape === 'diamond'
                            ? <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
                                <rect x={r*0.22} y={r*0.22} width={size-r*0.44} height={size-r*0.44} rx="2" fill={color} stroke="white" strokeWidth="1.5" transform={`rotate(45 ${r} ${r})`}/>
                              </svg>
                            : <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
                                <circle cx={r} cy={r} r={r-1.5} fill={color} stroke="white" strokeWidth="1.5"/>
                              </svg>
                          const anchorY = shape === 'pin' ? pinH : r
                          const showPulse = pulse && shape === 'dot'
                          return (
                            <div key={i} className="mc-marker-wrap" style={{ left: x, top: y }}>
                              {ring && shape === 'dot' && <div className="mc-marker-ring" style={{ width: size+14, height: size+14, borderColor: color, marginLeft: -(size+14)/2, marginTop: -(size+14)/2 }} />}
                              {showPulse && <div className="mc-marker-pulse" style={{ width: size+10, height: size+10, borderColor: color, marginLeft: -(size+10)/2, marginTop: -(size+10)/2 }} />}
                              <div style={{ marginLeft: -r, marginTop: -anchorY }}>{markerSvg}</div>
                              <div className="mc-marker-tooltip">{label}</div>
                            </div>
                          )
                        })
                        })()}
                      </div>
                    </div>

                    {/* Color pickers */}
                    <div className="mc-pickers-grid">
                      {[
                        { key: 'marker_color_own',      label: 'My club',    desc: 'Your own club(s) on the map' },
                        { key: 'marker_color_other',    label: 'Other clubs', desc: 'All other approved clubs' },
                        { key: 'marker_color_selected', label: 'Selected',   desc: 'Club currently selected in the panel' },
                        { key: 'marker_color_team',     label: 'Team clubs', desc: 'Clubs in your team (when team filter is on)' },
                      ].map(({ key, label, desc }) => {
                        const base = settings[key] || '#D94F4F'
                        // Generate 7 shade variants from the picked color
                        function hexToHsl(hex) {
                          const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255
                          const max = Math.max(r,g,b), min = Math.min(r,g,b)
                          let h, s, l = (max+min)/2
                          if (max === min) { h = s = 0 } else {
                            const d = max - min; s = l > 0.5 ? d/(2-max-min) : d/(max+min)
                            switch(max) {
                              case r: h = ((g-b)/d + (g<b?6:0))/6; break
                              case g: h = ((b-r)/d + 2)/6; break
                              default: h = ((r-g)/d + 4)/6
                            }
                          }
                          return [Math.round(h*360), Math.round(s*100), Math.round(l*100)]
                        }
                        function hslToHex(h,s,l) {
                          s/=100; l/=100
                          const a = s*Math.min(l,1-l)
                          const f = n => { const k=(n+h/30)%12; const c=l-a*Math.max(-1,Math.min(k-3,9-k,1)); return Math.round(255*c).toString(16).padStart(2,'0') }
                          return `#${f(0)}${f(8)}${f(4)}`
                        }
                        const [h,s] = hexToHsl(base)
                        const shades = [92,78,62,48,35,22,12].map(l => hslToHex(h, Math.min(s+10,100), l))
                        return (
                          <div key={key} className="mc-picker-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                              {/* Live shape preview using chosen shape + this color */}
                              {(() => {
                                const shape = settings.global_marker_shape || 'dot'
                                const c = settings[key] || '#ccc'
                                const sz = 20, r = 10
                                const pinH = 27
                                if (shape === 'pin') return <svg width={sz} height={pinH} viewBox="0 0 24 32" style={{flexShrink:0, filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.2))'}}><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill={c} stroke="white" strokeWidth="1.5"/><circle cx="12" cy="12" r="4.5" fill="white" opacity="0.92"/></svg>
                                if (shape === 'diamond') return <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{flexShrink:0}}><rect x={r*0.22} y={r*0.22} width={sz-r*0.44} height={sz-r*0.44} rx="2" fill={c} stroke="white" strokeWidth="1.5" transform={`rotate(45 ${r} ${r})`}/></svg>
                                return <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{flexShrink:0}}><circle cx={r} cy={r} r={r-1.5} fill={c} stroke="white" strokeWidth="1.5"/></svg>
                              })()}
                              <div className="mc-picker-label" style={{ margin: 0 }}>{label}</div>
                            </div>
                            <div className="mc-picker-desc">{desc}</div>
                            <div className="mc-custom-row" style={{ marginBottom: 10 }}>
                              <input
                                type="color"
                                className="mc-color-input"
                                value={settings[key] || '#000000'}
                                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                              />
                              <span className="mc-hex-value">{settings[key]}</span>
                              <div className="mc-current-dot" style={{ background: settings[key] }} />
                            </div>
                            <div className="mc-presets">
                              {shades.map(c => (
                                <button
                                  key={c}
                                  className={`mc-preset-swatch ${settings[key] === c ? 'active' : ''}`}
                                  style={{ background: c }}
                                  onClick={() => setSettings(s => ({ ...s, [key]: c }))}
                                  title={c}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Demographics */}
              {(() => {
                const DEMO_KEYS = ['demo_population','demo_income','demo_age_fit','demo_median_age','demo_poverty','demo_competition','demo_health','demo_spending','demo_growth','demo_commute','demo_competitors','demo_unemployment','demo_households']
                const enabledCount = DEMO_KEYS.filter(k => settings[k] !== false).length
                const totalCount   = DEMO_KEYS.length
                return (
                  <div className="admin-section" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      className="survey-toggle-btn"
                      style={{ padding: '14px 20px' }}
                      onClick={() => setDemoOpen(o => !o)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <h3 className="admin-section-title" style={{ margin: 0 }}>Demographics — Market Data</h3>
                        {enabledCount === totalCount
                          ? <span className="survey-complete-badge">All enabled</span>
                          : <span className="survey-progress-badge">{enabledCount} of {totalCount} enabled</span>
                        }
                      </div>
                      <svg className={`survey-chevron ${demoOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {demoOpen && (
                      <div style={{ padding: '14px 20px 16px' }}>
                        <p className="admin-section-desc" style={{ marginBottom: 14 }}>Control which data categories are visible to members. Members can further customize their own view within what you enable here.</p>
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
                    )}
                  </div>
                )
              })()}

              <div className="profile-actions" style={{ marginTop: 8, marginBottom: isSettingsDirty ? 80 : 16 }}>
                {savedSettings && <span className="save-confirm">✓ Settings saved</span>}
              </div>
              {/* Sticky save bar — only visible when dirty */}
              {isSettingsDirty && (
                <div className="save-bar save-bar--sticky save-bar--dirty">
                  <div className="save-bar-alert">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#B45309" strokeWidth="1.5"/>
                      <path d="M8 5v4" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="8" cy="11.5" r="0.75" fill="#B45309"/>
                    </svg>
                    Unsaved changes
                  </div>
                  <div className="save-bar-btns">
                    <button className="btn-save" onClick={handleSaveSettings} disabled={savingSettings}>
                      {savingSettings ? 'Saving…' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACCESS CONTROLS TAB ── */}
      {tab === 'access' && (() => {
        const ACCESS_SWITCHES = [
          { key: 'member_signups_enabled', label: 'New member signups',  hint: 'Allow new club owners to create an account', onStatus: 'Open',    offStatus: 'Paused', group: 'member' },
          { key: 'member_login_enabled',   label: 'Member login',        hint: 'Allow existing club owners to log in',       onStatus: 'Active',  offStatus: 'Paused', group: 'member' },
          { key: 'public_search_enabled',  label: 'Public club search',  hint: 'Allow visitors to search and find clubs',    onStatus: 'Visible', offStatus: 'Hidden',  group: 'public' },
          { key: 'public_accounts_enabled',label: 'Public account signups', hint: 'Allow visitors to create a public account', onStatus: 'Open',  offStatus: 'Paused', group: 'public' },
          { key: 'public_login_enabled',   label: 'Public account login', hint: 'Allow existing public accounts to log in',  onStatus: 'Active',  offStatus: 'Paused', group: 'public' },
        ]
        const paused = ACCESS_SWITCHES.filter(s => settings[s.key] === false)
        const anyPaused = paused.length > 0
        return (
          <div>
            {/* Status card */}
            <div className="admin-section" style={{ border: anyPaused ? '0.5px solid #EF9F27' : '0.5px solid #4CAF82', background: anyPaused ? '#FFFBEB' : '#f7fdf9', padding: '14px 18px', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {anyPaused ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="6.5" stroke="#854F0B" strokeWidth="1.2"/>
                      <path d="M8 5v4" stroke="#854F0B" strokeWidth="1.2" strokeLinecap="round"/>
                      <circle cx="8" cy="11" r="0.75" fill="#854F0B"/>
                    </svg>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#633806' }}>{paused.length} control{paused.length > 1 ? 's' : ''} currently paused</div>
                      <div style={{ fontSize: 11, color: '#854F0B', marginTop: 2 }}>{paused.map(s => s.label).join(' · ')}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="8" cy="8" r="6.5" stroke="#0F6E56" strokeWidth="1.2"/>
                      <path d="M4.5 8l2 2 4-4" stroke="#0F6E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#085041' }}>All access controls active</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ padding: '20px 0 8px' }}>
              <p className="admin-section-desc">Master switches for platform access. Turning anything off never deletes data — it just pauses access. Your admin account is unaffected by all toggles.</p>
            </div>

            <div className="ac-group-label ac-group-member">Club owners</div>
            <div className="ac-switches-grid">
              {ACCESS_SWITCHES.filter(s => s.group === 'member').map(({ key, label, hint, onStatus, offStatus }) => {
                const on = settings[key]
                return (
                  <div key={key} className={`ac-switch-card ${on ? 'on' : 'off'}`} onClick={() => setSettings(s => ({ ...s, [key]: !on }))}>
                    <div className="ac-switch-top">
                      <div className="ac-switch-text">
                        <div className="ac-switch-label">{label}</div>
                        <div className="ac-switch-hint">{hint}</div>
                        <div className={`ac-status-pill ${on ? 'on' : 'off'}`}>
                          <span className={`ac-status-dot ${on ? 'on' : 'off'}`} />
                          {on ? onStatus : offStatus}
                        </div>
                      </div>
                      <div className={`ac-ls-body ${on ? 'on' : 'off'}`}>
                        {on  && <span className="ac-ls-label">ON</span>}
                        {!on && <span className="ac-ls-spacer" />}
                        <div className="ac-ls-plate"><div className="ac-ls-rocker" /></div>
                        {on  && <span className="ac-ls-spacer" />}
                        {!on && <span className="ac-ls-label">OFF</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="ac-group-label ac-group-public">Public users</div>
            <div className="ac-switches-grid">
              {ACCESS_SWITCHES.filter(s => s.group === 'public').map(({ key, label, hint, onStatus, offStatus }) => {
                const on = settings[key]
                return (
                  <div key={key} className={`ac-switch-card ${on ? 'on' : 'off'}`} onClick={() => setSettings(s => ({ ...s, [key]: !on }))}>
                    <div className="ac-switch-top">
                      <div className="ac-switch-text">
                        <div className="ac-switch-label">{label}</div>
                        <div className="ac-switch-hint">{hint}</div>
                        <div className={`ac-status-pill ${on ? 'on' : 'off'}`}>
                          <span className={`ac-status-dot ${on ? 'on' : 'off'}`} />
                          {on ? onStatus : offStatus}
                        </div>
                      </div>
                      <div className={`ac-ls-body ${on ? 'on' : 'off'}`}>
                        {on  && <span className="ac-ls-label">ON</span>}
                        {!on && <span className="ac-ls-spacer" />}
                        <div className="ac-ls-plate"><div className="ac-ls-rocker" /></div>
                        {on  && <span className="ac-ls-spacer" />}
                        {!on && <span className="ac-ls-label">OFF</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sticky save bar */}
            {isSettingsDirty && (
              <div className="save-bar save-bar--sticky save-bar--dirty">
                <div className="save-bar-alert">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#B45309" strokeWidth="1.5"/>
                    <path d="M8 5v4" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="11.5" r="0.75" fill="#B45309"/>
                  </svg>
                  Unsaved changes
                </div>
                <div className="save-bar-btns">
                  <button className="btn-save" onClick={handleSaveSettings} disabled={savingSettings}>
                    {savingSettings ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TEAMS TAB ── */}
      {tab === 'teams' && (
        <div>
          <div className="admin-section" style={{ marginBottom: 16 }}>
            <h3 className="admin-section-title">All Teams</h3>
            <p className="admin-section-desc">Every team in the system — who created it, its members, and their status. You can dissolve a team or remove individual members.</p>
          </div>
          {!teamsLoaded ? (
            <div className="admin-loading">Loading teams…</div>
          ) : allTeams.length === 0 ? (
            <div className="admin-empty">No teams have been created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allTeams.map(team => {
                const accepted = team.team_members?.filter(m => m.status === 'accepted') || []
                const pending  = team.team_members?.filter(m => m.status === 'pending')  || []
                const ownerMember = members.find(m => m.user_id === team.owner_user_id)
                const ownerName = ownerMember ? [ownerMember.first_name, ownerMember.last_name].filter(Boolean).join(' ') || ownerMember.club_name : 'Unknown'
                return (
                  <div key={team.id} className="admin-section" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A3C2E', marginBottom: 2 }}>{team.name}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          Created by {ownerName} · {new Date(team.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, background: '#E1F5EE', color: '#085041', padding: '2px 8px', borderRadius: 10 }}>
                          {accepted.length} member{accepted.length !== 1 ? 's' : ''}
                        </span>
                        {pending.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 500, background: '#FEF3C7', color: '#854F0B', padding: '2px 8px', borderRadius: 10 }}>
                            {pending.length} pending
                          </span>
                        )}
                        <button
                          onClick={() => { if (window.confirm(`Dissolve "${team.name}"? This removes all members and cannot be undone.`)) handleDissolveTeam(team.id) }}
                          style={{ fontSize: 11, color: '#A32D2D', background: '#FCEBEB', border: '0.5px solid #f09595', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}
                        >
                          Dissolve
                        </button>
                      </div>
                    </div>
                    {team.team_members?.length > 0 && (
                      <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {team.team_members.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                                background: m.status === 'accepted' ? '#E1F5EE' : m.status === 'pending' ? '#FEF3C7' : '#FCEBEB',
                                color:      m.status === 'accepted' ? '#085041' : m.status === 'pending' ? '#854F0B' : '#791F1F',
                              }}>{m.status}</span>
                              <span style={{ color: '#333', fontWeight: 500 }}>{m.locations?.club_name || 'Unknown club'}</span>
                              <span style={{ color: '#888' }}>{[m.locations?.city, m.locations?.state].filter(Boolean).join(', ')}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveTeamMember(m.id, team.id)}
                              style={{ fontSize: 10, color: '#666', background: '#f5f5f5', border: '0.5px solid #ddd', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
            <button
              className={`msg-subtab ${msgSubTab === 'notes' ? 'active' : ''}`}
              onClick={() => { setMsgSubTab('notes'); if (!notesLoaded) loadClubNotes() }}
            >
              Club notes
              {clubNotes.filter(n => !n.forwarded).length > 0 && (
                <span className="msg-unread-badge">{clubNotes.filter(n => !n.forwarded).length}</span>
              )}
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
                        expanded={expandedContact === c.id}
                        onToggle={() => setExpandedContact(expandedContact === c.id ? null : c.id)}
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

          {/* ── Club Notes sub-tab ── */}
          {msgSubTab === 'notes' && (
            <div>
              {!notesLoaded ? (
                <div className="admin-loading">Loading notes…</div>
              ) : clubNotes.length === 0 ? (
                <div className="admin-empty">No club notes yet. Notes submitted by public users will appear here.</div>
              ) : (
                <div className="notif-list">
                  {clubNotes.map(n => (
                    <div key={n.id} className="notif-card" style={{ alignItems: 'flex-start' }}>
                      <div className="notif-icon" style={{ marginTop: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div className="notif-body" style={{ flex: 1 }}>
                        <div className="notif-title" style={{ marginBottom: 3 }}>
                          {n.locations?.club_name || 'Unknown club'}
                          {n.forwarded && (
                            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, background: '#E1F5EE', color: '#085041', padding: '1px 7px', borderRadius: 10 }}>
                              Forwarded ✓
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5, marginBottom: 5, background: '#f7f9f7', borderLeft: '2px solid #4CAF82', padding: '6px 10px', borderRadius: '0 5px 5px 0' }}>
                          {n.note}
                        </div>
                        <div className="notif-time">
                          From: {n.public_accounts?.display_name || n.public_accounts?.email || 'Anonymous'}
                          {' · '}
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      {!n.forwarded && (
                        <button
                          className="notif-action-btn"
                          style={{ flexShrink: 0, marginTop: 2 }}
                          onClick={() => forwardNote(n)}
                          disabled={forwardingNoteId === n.id}
                        >
                          {forwardingNoteId === n.id ? 'Sending…' : 'Forward to owner →'}
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
