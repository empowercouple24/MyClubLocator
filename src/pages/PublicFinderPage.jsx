import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

function PinIcon({ size = 16, color = '#1A3C2E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={color}/>
    </svg>
  )
}

function HeartIcon({ filled }) {
  return filled ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function getTodayHours(loc) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const today = days[new Date().getDay()]
  const open  = loc[`hours_${today}_open`]
  const close = loc[`hours_${today}_close`]
  if (!open || !close) return null
  const fmt = t => {
    const [h, m] = t.split(':').map(Number)
    const period = h < 12 ? 'AM' : 'PM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2,'0')} ${period}`
  }
  return `${fmt(open)} – ${fmt(close)}`
}

function isOpenNow(loc) {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const today = days[new Date().getDay()]
  const open  = loc[`hours_${today}_open`]
  const close = loc[`hours_${today}_close`]
  if (!open || !close) return false
  const now = new Date()
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm
}

function MapboxTile({ lat, lng, clubName }) {
  if (!MAPBOX_TOKEN || !lat || !lng) return null
  const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+F59E0B(${lng},${lat})/${lng},${lat},15,0/400x200@2x?access_token=${MAPBOX_TOKEN}`
  return <img src={url} alt={`Map showing ${clubName}`} className="pf-map-tile" loading="lazy" />
}

function DisclaimerScreen({ text, onAccept }) {
  return (
    <div className="pf-disclaimer-screen">
      <div className="pf-disclaimer-card">
        <div className="pf-disclaimer-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#854F0B" strokeWidth="1.5"/>
            <path d="M12 7v6" stroke="#854F0B" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16.5" r="0.75" fill="#854F0B"/>
          </svg>
        </div>
        <h2 className="pf-disclaimer-title">Before you search</h2>
        <p className="pf-disclaimer-text">{text}</p>
        <button className="pf-accept-btn" onClick={onAccept}>I understand — continue to search</button>
      </div>
    </div>
  )
}

// ── Auth Modal ─────────────────────────────────────────────
function AuthModal({ mode: initialMode, settings, onSuccess, onClose }) {
  const [mode, setMode]               = useState(initialMode || 'signin')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (mode === 'signup') {
      if (settings?.public_accounts_enabled === false) {
        setError('New public accounts are not available right now.')
        setLoading(false)
        return
      }
      const { data, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) { setError(authErr.message); setLoading(false); return }
      if (data?.user) {
        await supabase.from('public_accounts').insert({
          auth_user_id: data.user.id,
          email,
          display_name: displayName.trim() || null,
        })
      }
      onSuccess()
    } else {
      if (settings?.public_login_enabled === false) {
        setError('Public account login is temporarily unavailable.')
        setLoading(false)
        return
      }
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) { setError(authErr.message); setLoading(false); return }
      onSuccess()
    }
  }

  return (
    <div className="pf-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pf-modal-card">
        <button className="pf-modal-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="pf-modal-tabs">
          <button className={`pf-modal-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
          {settings?.public_accounts_enabled !== false && (
            <button className={`pf-modal-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError('') }}>Create account</button>
          )}
        </div>
        <p className="pf-modal-desc">
          {mode === 'signup' ? 'Save your favorite clubs and leave notes.' : 'Welcome back — sign in to see your saved clubs.'}
        </p>
        {error && <div className="pf-modal-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <input className="pf-modal-input" type="text" placeholder="Your name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          )}
          <input className="pf-modal-input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="pf-modal-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button className="pf-accept-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Saved Clubs Panel ──────────────────────────────────────
function SavedPanel({ savedClubs, expandedId, onExpand, onClose, onToggleFav, favIds }) {
  const [open, setOpen] = useState(false)
  if (!savedClubs.length) return null
  return (
    <div className="pf-saved-panel">
      <button className="pf-saved-header" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeartIcon filled />
          <span className="pf-saved-title">My saved clubs</span>
          <span className="pf-saved-count">{savedClubs.length}</span>
        </div>
        <svg className={`pf-chevron ${open ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="pf-saved-list">
          {savedClubs.map(club => (
            <ClubCard
              key={club.id}
              club={club}
              distanceMiles={null}
              expanded={expandedId === club.id}
              onExpand={() => onExpand(club.id)}
              onClose={onClose}
              isFav={favIds.has(club.id)}
              onToggleFav={() => onToggleFav(club.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Club Card ──────────────────────────────────────────────
function ClubCard({ club, distanceMiles, onExpand, expanded, onClose, isFav, onToggleFav, onAuthRequired, publicAccountId }) {
  const hours  = getTodayHours(club)
  const open   = isOpenNow(club)
  const owners = [
    club.first_name && `${club.first_name}${club.last_name ? ' ' + club.last_name : ''}`,
    club.owner2_first_name && `${club.owner2_first_name}${club.owner2_last_name ? ' ' + club.owner2_last_name : ''}`,
    club.owner3_first_name && `${club.owner3_first_name}${club.owner3_last_name ? ' ' + club.owner3_last_name : ''}`,
  ].filter(Boolean)

  const [noteText, setNoteText]     = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteSent, setNoteSent]     = useState(false)
  const [noteOpen, setNoteOpen]     = useState(false)

  async function submitNote() {
    if (!noteText.trim() || !publicAccountId) return
    setNoteSubmitting(true)
    await supabase.from('club_notes').insert({
      public_account_id: publicAccountId,
      location_id: club.id,
      note: noteText.trim(),
    })
    await supabase.from('notifications').insert({
      type: 'club_note',
      title: 'New note on a club',
      body: `A public user left a note on ${club.club_name || 'a club'}: "${noteText.trim().slice(0, 80)}${noteText.length > 80 ? '…' : ''}"`,
      user_id: null,
    })
    setNoteSubmitting(false)
    setNoteSent(true)
    setNoteText('')
    setTimeout(() => { setNoteSent(false); setNoteOpen(false) }, 2500)
  }

  return (
    <div className={`pf-club-card ${expanded ? 'expanded' : ''}`}>
      <div className="pf-club-card-header" onClick={expanded ? onClose : onExpand}>
        <div className="pf-club-card-left">
          <div className="pf-club-name">{club.club_name || 'Unnamed Club'}</div>
          <div className="pf-club-meta">
            <span className="pf-club-addr">{[club.city, club.state].filter(Boolean).join(', ')}</span>
            {distanceMiles != null && <span className="pf-club-dist">{distanceMiles.toFixed(1)} mi</span>}
          </div>
          {hours && (
            <div className="pf-club-hours">
              <ClockIcon />
              <span className={open ? 'pf-open' : 'pf-closed'}>{open ? 'Open now' : 'Closed'}</span>
              <span className="pf-hours-text">{hours}</span>
            </div>
          )}
        </div>
        <div className="pf-club-card-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onToggleFav !== undefined && (
            <button
              className={`pf-heart-btn ${isFav ? 'fav' : ''}`}
              onClick={e => { e.stopPropagation(); onToggleFav ? onToggleFav() : onAuthRequired?.() }}
              title={isFav ? 'Remove from saved' : 'Save this club'}
            >
              <HeartIcon filled={isFav} />
            </button>
          )}
          {onAuthRequired && !onToggleFav && (
            <button className="pf-heart-btn" onClick={e => { e.stopPropagation(); onAuthRequired() }} title="Save this club">
              <HeartIcon filled={false} />
            </button>
          )}
          <svg className={`pf-chevron ${expanded ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="pf-club-detail">
          <MapboxTile lat={club.lat} lng={club.lng} clubName={club.club_name} />

          {club.address && (
            <div className="pf-detail-row">
              <PinIcon size={13} color="#888" />
              <span>{club.address}{club.city ? `, ${club.city}` : ''}{club.state ? `, ${club.state}` : ''}{club.zip ? ` ${club.zip}` : ''}</span>
            </div>
          )}
          {club.club_phone && (
            <div className="pf-detail-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.93 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.84 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>{club.club_phone}</span>
            </div>
          )}
          {club.club_email && (
            <div className="pf-detail-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.5"/></svg>
              <span>{club.club_email}</span>
            </div>
          )}
          {owners.length > 0 && (
            <div className="pf-detail-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/></svg>
              <span>{owners.join(', ')}</span>
            </div>
          )}

          {(() => {
            const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
            const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
            const fmt = t => {
              if (!t) return ''
              const [h, m] = t.split(':').map(Number)
              const period = h < 12 ? 'AM' : 'PM'
              const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
              return `${hour}:${String(m).padStart(2,'0')} ${period}`
            }
            const openDays = days.map((d, i) => ({ label: labels[i], o: club[`hours_${d}_open`], c: club[`hours_${d}_close`] })).filter(d => d.o && d.c)
            if (!openDays.length) return null
            return (
              <div className="pf-hours-block">
                <div className="pf-hours-title">Hours</div>
                {openDays.map((d, i) => (
                  <div key={i} className="pf-hours-row">
                    <span className="pf-hours-day">{d.label}</span>
                    <span className="pf-hours-time">{fmt(d.o)} – {fmt(d.c)}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {club.photo_urls && club.photo_urls.length > 0 && (
            <div className="pf-photos">
              {club.photo_urls.slice(0, 4).map((url, i) => (
                <div key={i} className="pf-photo-thumb"><img src={url} alt={`Club photo ${i+1}`} /></div>
              ))}
            </div>
          )}

          {/* Leave a note — only when logged in */}
          {publicAccountId && (
            <div className="pf-note-section">
              {!noteOpen && !noteSent && (
                <button className="pf-note-toggle" onClick={() => setNoteOpen(true)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Leave a note about this club
                </button>
              )}
              {noteOpen && !noteSent && (
                <div className="pf-note-form">
                  <textarea
                    className="pf-note-input"
                    rows={3}
                    placeholder="Share your experience or anything useful about this club…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    autoFocus
                  />
                  <div className="pf-note-actions">
                    <button className="pf-note-cancel" onClick={() => { setNoteOpen(false); setNoteText('') }}>Cancel</button>
                    <button className="pf-note-submit" onClick={submitNote} disabled={noteSubmitting || !noteText.trim()}>
                      {noteSubmitting ? 'Sending…' : 'Submit note'}
                    </button>
                  </div>
                </div>
              )}
              {noteSent && (
                <div className="pf-note-sent">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#0F6E56" strokeWidth="1.2"/><path d="M5 8l2 2 4-4" stroke="#0F6E56" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Note submitted — thank you!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function PublicFinderPage() {
  const navigate = useNavigate()
  const [settings, setSettings]         = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [accepted, setAccepted]         = useState(false)
  const [query, setQuery]               = useState('')
  const [searching, setSearching]       = useState(false)
  const [userLat, setUserLat]           = useState(null)
  const [userLng, setUserLng]           = useState(null)
  const [geoLocating, setGeoLocating]   = useState(false)
  const [geoError, setGeoError]         = useState('')
  const [results, setResults]           = useState(null)
  const [expandedId, setExpandedId]     = useState(null)

  // Auth state
  const [publicAccount, setPublicAccount] = useState(null) // { id, display_name, email }
  const [authModal, setAuthModal]         = useState(null) // null | 'signin' | 'signup'
  const [authLoading, setAuthLoading]     = useState(true)

  // Favorites
  const [favIds, setFavIds]         = useState(new Set())
  const [savedClubs, setSavedClubs] = useState([])

  const inputRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [{ data: s }, session] = await Promise.all([
        supabase.from('app_settings').select('public_search_enabled,public_accounts_enabled,public_login_enabled,public_finder_welcome,public_finder_disclaimer_enabled,public_finder_disclaimer').eq('id', 1).single(),
        supabase.auth.getSession(),
      ])
      setSettings(s)
      if (session.data.session) await loadPublicAccount(session.data.session.user.id)
      setAuthLoading(false)
      setLoadingSettings(false)
    }
    load()
  }, [])

  async function loadPublicAccount(authUserId) {
    const { data } = await supabase.from('public_accounts').select('id,display_name,email').eq('auth_user_id', authUserId).single()
    if (data) {
      setPublicAccount(data)
      await loadFavorites(data.id)
    }
  }

  async function loadFavorites(accountId) {
    const { data } = await supabase
      .from('public_favorites')
      .select('location_id, locations(id,club_name,address,city,state,zip,lat,lng,club_phone,club_email,first_name,last_name,owner2_first_name,owner2_last_name,photo_urls,hours_monday_open,hours_monday_close,hours_tuesday_open,hours_tuesday_close,hours_wednesday_open,hours_wednesday_close,hours_thursday_open,hours_thursday_close,hours_friday_open,hours_friday_close,hours_saturday_open,hours_saturday_close,hours_sunday_open,hours_sunday_close)')
      .eq('public_account_id', accountId)
    if (data) {
      setFavIds(new Set(data.map(f => f.location_id)))
      setSavedClubs(data.map(f => f.locations).filter(Boolean))
    }
  }

  async function toggleFavorite(locationId) {
    if (!publicAccount) return
    if (favIds.has(locationId)) {
      await supabase.from('public_favorites').delete().eq('public_account_id', publicAccount.id).eq('location_id', locationId)
      setFavIds(prev => { const n = new Set(prev); n.delete(locationId); return n })
      setSavedClubs(prev => prev.filter(c => c.id !== locationId))
    } else {
      await supabase.from('public_favorites').insert({ public_account_id: publicAccount.id, location_id: locationId })
      setFavIds(prev => new Set([...prev, locationId]))
      const club = results?.find(r => r.id === locationId)
      if (club) setSavedClubs(prev => [...prev, club])
    }
  }

  async function handleAuthSuccess() {
    setAuthModal(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await loadPublicAccount(session.user.id)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setPublicAccount(null)
    setFavIds(new Set())
    setSavedClubs([])
  }

  async function geocodeAddress(address) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`)
      const data = await res.json()
      if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {}
    return null
  }

  async function doSearch(lat, lng) {
    setSearching(true)
    setExpandedId(null)
    const { data } = await supabase
      .from('locations')
      .select('id,club_name,address,city,state,zip,lat,lng,club_phone,club_email,first_name,last_name,owner2_first_name,owner2_last_name,owner3_first_name,owner3_last_name,photo_urls,hours_monday_open,hours_monday_close,hours_tuesday_open,hours_tuesday_close,hours_wednesday_open,hours_wednesday_close,hours_thursday_open,hours_thursday_close,hours_friday_open,hours_friday_close,hours_saturday_open,hours_saturday_close,hours_sunday_open,hours_sunday_close')
      .eq('approved', true)
      .eq('club_index', 0)
    if (!data) { setSearching(false); return }
    const withDist = data
      .filter(loc => loc.lat && loc.lng)
      .map(loc => ({ ...loc, distanceMiles: getDistanceMiles(lat, lng, loc.lat, loc.lng) }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 25)
    setResults(withDist)
    setSearching(false)
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    const coords = await geocodeAddress(query.trim())
    if (!coords) { setGeoError('Address not found. Try a city or zip code.'); return }
    setGeoError('')
    setUserLat(coords.lat); setUserLng(coords.lng)
    doSearch(coords.lat, coords.lng)
  }

  function handleGeolocate() {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported by your browser.'); return }
    setGeoLocating(true); setGeoError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setUserLat(latitude); setUserLng(longitude)
        setGeoLocating(false)
        doSearch(latitude, longitude)
      },
      () => { setGeoError('Could not get your location. Try entering an address.'); setGeoLocating(false) }
    )
  }

  if (loadingSettings || authLoading) return <div className="loading">Loading…</div>

  if (!settings?.public_search_enabled) {
    return (
      <div className="pf-page">
        <div className="pf-closed">
          <div className="pf-closed-icon"><PinIcon size={32} color="#1A3C2E" /></div>
          <h1 className="pf-closed-title">Club Finder</h1>
          <p className="pf-closed-msg">The club finder is not available right now. Please check back soon.</p>
          <button className="pf-back-btn-plain" onClick={() => navigate('/')}>← Back to home</button>
        </div>
      </div>
    )
  }

  if (settings?.public_finder_disclaimer_enabled && !accepted) {
    return (
      <div className="pf-page">
        <div className="pf-topbar">
          <button className="pf-back-btn" onClick={() => navigate('/')}>← Back</button>
          <div className="pf-brand"><PinIcon size={14} color="#fff" /><span>My Club Locator</span></div>
        </div>
        <DisclaimerScreen text={settings.public_finder_disclaimer} onAccept={() => setAccepted(true)} />
      </div>
    )
  }

  return (
    <div className="pf-page">
      {/* Top bar */}
      <div className="pf-topbar">
        <button className="pf-back-btn" onClick={() => navigate('/')}>← Back</button>
        <div className="pf-brand"><PinIcon size={14} color="#fff" /><span>My Club Locator</span></div>
        <div className="pf-auth-zone">
          {publicAccount ? (
            <>
              <span className="pf-auth-name">Hi, {publicAccount.display_name || publicAccount.email?.split('@')[0]}</span>
              <button className="pf-auth-link" onClick={handleSignOut}>Sign out</button>
            </>
          ) : settings?.public_accounts_enabled !== false ? (
            <>
              <button className="pf-auth-link" onClick={() => setAuthModal('signin')}>Sign in</button>
              <button className="pf-auth-link pf-auth-link--accent" onClick={() => setAuthModal('signup')}>Create account</button>
            </>
          ) : null}
        </div>
      </div>

      {/* Search header */}
      <div className="pf-search-header">
        <h1 className="pf-search-title">{settings?.public_finder_welcome || 'Find a nutrition club near you'}</h1>
        <form className="pf-search-form" onSubmit={handleSearch}>
          <div className="pf-search-row">
            <input ref={inputRef} className="pf-search-input" type="text" placeholder="Enter city, address, or zip code…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            <button className="pf-search-btn" type="submit" disabled={searching}>
              {searching ? '…' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
            </button>
          </div>
          <button type="button" className="pf-locate-btn" onClick={handleGeolocate} disabled={geoLocating}>
            {geoLocating ? <span className="pf-locate-spinner" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/></svg>}
            {geoLocating ? 'Locating…' : 'Use my location'}
          </button>
        </form>
        {geoError && <div className="pf-geo-error">{geoError}</div>}
      </div>

      {/* Saved panel */}
      {publicAccount && savedClubs.length > 0 && (
        <div style={{ padding: '12px 16px 0', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <SavedPanel
            savedClubs={savedClubs}
            expandedId={expandedId}
            onExpand={id => setExpandedId(id)}
            onClose={() => setExpandedId(null)}
            onToggleFav={toggleFavorite}
            favIds={favIds}
          />
        </div>
      )}

      {/* Results */}
      <div className="pf-results">
        {results === null && !searching && (
          <div className="pf-empty-state">
            <PinIcon size={36} color="#ccc" />
            <p>Enter your location above to find clubs near you</p>
          </div>
        )}
        {searching && (
          <div className="pf-loading-state">
            <div className="pf-spinner" />
            <p>Searching for clubs…</p>
          </div>
        )}
        {results !== null && !searching && results.length === 0 && (
          <div className="pf-empty-state">
            <PinIcon size={36} color="#ccc" />
            <p>No clubs found near that location.<br/>Try a nearby city or zip code.</p>
          </div>
        )}
        {results !== null && !searching && results.length > 0 && (
          <>
            <div className="pf-results-header">{results.length} club{results.length !== 1 ? 's' : ''} found nearby</div>
            {results.map(club => (
              <ClubCard
                key={club.id}
                club={club}
                distanceMiles={club.distanceMiles}
                expanded={expandedId === club.id}
                onExpand={() => setExpandedId(club.id)}
                onClose={() => setExpandedId(null)}
                isFav={favIds.has(club.id)}
                onToggleFav={publicAccount ? () => toggleFavorite(club.id) : undefined}
                onAuthRequired={!publicAccount && settings?.public_accounts_enabled !== false ? () => setAuthModal('signin') : undefined}
                publicAccountId={publicAccount?.id}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="pf-footer">
        <span>Are you a club owner?</span>
        <button className="pf-footer-link" onClick={() => navigate('/login')}>Log in to manage your club →</button>
      </div>

      {/* Auth modal */}
      {authModal && (
        <AuthModal
          mode={authModal}
          settings={settings}
          onSuccess={handleAuthSuccess}
          onClose={() => setAuthModal(null)}
        />
      )}
    </div>
  )
}
