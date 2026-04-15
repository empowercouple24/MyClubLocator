import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { supabase } from '../lib/supabase'
import { geocodeSingle } from '../lib/geocode'
import AddressAutocomplete from '../components/AddressAutocomplete'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAPBOX_URL   = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
const MAPBOX_ATTR  = '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function makeClubIcon(type, fill, hovered, sizeScale = 1) {
  const sizes = { normal: Math.round(18 * sizeScale), hovered: Math.round(24 * sizeScale), selected: Math.round(28 * sizeScale) }
  const size = type === 'selected' ? sizes.selected : hovered ? sizes.hovered : sizes.normal
  const r = size / 2
  if (type === 'selected') {
    return divIcon({
      className: '',
      html: `<div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">
        <div class="marker-pulse-ring marker-pulse-ring--1" style="--pulse-color:${fill};"></div>
        <div class="marker-pulse-ring marker-pulse-ring--2" style="--pulse-color:${fill};"></div>
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="position:relative;z-index:2;">
          <circle cx="${r}" cy="${r}" r="${r-1.5}" fill="${fill}" stroke="white" stroke-width="2.5"/>
        </svg>
      </div>`,
      iconSize: [size, size], iconAnchor: [r, r],
    })
  }
  // Regular markers — ambient pulse like 'own' type on MapPage
  return divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);transition:all 0.15s;">
      <div class="marker-own-pulse" style="--pulse-color:${fill};"></div>
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="position:relative;z-index:2;">
        <circle cx="${r}" cy="${r}" r="${r-1.5}" fill="${fill}" stroke="white" stroke-width="2"/>
      </svg>
    </div>`,
    iconSize: [size, size], iconAnchor: [r, r],
  })
}

function makeUserIcon(sizeScale = 1) {
  const s = Math.round(20 * sizeScale)
  const r = s / 2
  const ir = Math.round(7 * sizeScale)
  const cr = Math.round(3 * sizeScale)
  const pr = Math.round(6 * sizeScale)
  return divIcon({
    className: '',
    html: `<div style="position:relative;width:${s}px;height:${s}px;transform:translate(-50%,-50%);">
      <div style="position:absolute;inset:-${pr}px;border-radius:50%;border:2px solid #185FA5;opacity:0.35;animation:pfUserPulse 2s ease-in-out infinite;"></div>
      <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <circle cx="${r}" cy="${r}" r="${ir}" fill="#185FA5" stroke="white" stroke-width="2.5"/>
        <circle cx="${r}" cy="${r}" r="${cr}" fill="white"/>
      </svg>
      <div class="you-are-here-label">YOU ARE HERE</div>
    </div>`,
    iconSize: [s, s], iconAnchor: [r, r],
  })
}

function MapFlyTo({ lat, lng, zoom, bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true })
    } else if (lat && lng) {
      map.flyTo([lat, lng], zoom || 13, { duration: 1 })
    }
  }, [lat, lng, zoom, bounds])
  return null
}

function FindExtentTracker() {
  const map = useMap()
  useEffect(() => {
    function save() {
      const c = map.getCenter()
      sessionStorage.setItem('findExtent', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }))
    }
    map.on('moveend', save)
    map.on('zoomend', save)
    save()
    return () => { map.off('moveend', save); map.off('zoomend', save) }
  }, [map])
  return null
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

function buildCondensedHours(club) {
  const days   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const fmt = t => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h < 12 ? 'AM' : 'PM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2,'0')} ${period}`
  }
  const openDays = days.map((d, i) => ({
    idx: i, label: labels[i],
    o: club[`hours_${d}_open`] || '',
    c: club[`hours_${d}_close`] || '',
    open: !!(club[`hours_${d}_open`] && club[`hours_${d}_close`])
  })).filter(d => d.open)
  if (!openDays.length) return []
  const ranges = []
  let run = [openDays[0]]
  for (let i = 1; i < openDays.length; i++) {
    const prev = run[run.length - 1], curr = openDays[i]
    if (curr.idx === prev.idx + 1 && curr.o === prev.o && curr.c === prev.c) run.push(curr)
    else { ranges.push(run); run = [curr] }
  }
  ranges.push(run)
  return ranges.map(r => ({
    day: r.length === 1 ? r[0].label : `${r[0].label}–${r[r.length-1].label}`,
    hours: `${fmt(r[0].o)} – ${fmt(r[0].c)}`,
    idxStart: r[0].idx, idxEnd: r[r.length-1].idx,
  }))
}

function getTodayIdx() { return (new Date().getDay() + 6) % 7 }

function HeartIcon({ filled }) {
  return filled
    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}

function ShareLocationButton({ club, className }) {
  const [copied, setCopied] = useState(false)
  const fullAddr = [club.address, club.city, club.state, club.zip].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`
  const shareText = `${club.club_name || 'Nutrition Club'} — ${fullAddr}`

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: club.club_name || 'Nutrition Club', text: shareText, url: mapsUrl }); return }
      catch (e) { if (e.name === 'AbortError') return }
    }
    try {
      await navigator.clipboard.writeText(mapsUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2200)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = mapsUrl; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2200)
    }
  }

  return (
    <button className={`share-location-btn ${copied ? 'share-location-btn--copied' : ''} ${className || ''}`} onClick={handleShare}>
      {copied ? (
        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Link copied!</>
      ) : (
        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="1.8"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="1.8"/></svg> Share location</>
      )}
    </button>
  )
}

function ClubLogo({ url, name }) {
  if (url) return <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="rgba(255,255,255,0.85)"/></svg>
}

function DisclaimerScreen({ text, onAccept }) {
  const [dismissing, setDismissing] = useState(false)

  function handleAccept() {
    setDismissing(true)
    setTimeout(() => onAccept(), 600)
  }

  return (
    <div className={`pf-disc-overlay ${dismissing ? 'pf-disc-overlay--out' : ''}`}>
      <div className="pf-disc-card">
        <div className="pf-disclaimer-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#854F0B" strokeWidth="1.5"/>
            <path d="M12 7v6" stroke="#854F0B" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="12" cy="16.5" r="0.75" fill="#854F0B"/>
          </svg>
        </div>
        <h2 className="pf-disclaimer-title">Before you search</h2>
        <div className="pf-disclaimer-text rte-content" dangerouslySetInnerHTML={{ __html: text }} />
        <button className="pf-accept-btn" onClick={handleAccept}>I understand — continue to search</button>
      </div>
    </div>
  )
}

function AuthModal({ mode: initialMode, settings, onSuccess, onClose }) {
  const [mode, setMode]       = useState(initialMode || 'signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true)
    if (mode === 'signup') {
      if (settings?.public_accounts_enabled === false) { setError('New public accounts are not available right now.'); setLoading(false); return }
      const { data, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) { setError(authErr.message); setLoading(false); return }
      if (data?.user) await supabase.from('public_accounts').insert({ auth_user_id: data.user.id, email, display_name: displayName.trim() || null })
      onSuccess()
    } else {
      if (settings?.public_login_enabled === false) { setError('Public account login is temporarily unavailable.'); setLoading(false); return }
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) { setError(authErr.message); setLoading(false); return }
      onSuccess()
    }
  }

  return (
    <div className="pf-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pf-modal-card">
        <button className="pf-modal-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <div className="pf-modal-tabs">
          <button className={`pf-modal-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
          {settings?.public_accounts_enabled !== false && (
            <button className={`pf-modal-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError('') }}>Create account</button>
          )}
        </div>
        <p className="pf-modal-desc">{mode === 'signup' ? 'Save your favorite clubs and leave notes.' : 'Welcome back — sign in to see your saved clubs.'}</p>
        {error && <div className="pf-modal-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && <input className="pf-modal-input" type="text" name="displayName" id="pf-display-name" placeholder="Your name (optional)" value={displayName} onChange={e => setDisplayName(e.target.value)} />}
          <input className="pf-modal-input" type="email" name="email" id="pf-email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="pf-modal-input" type="password" name="password" id="pf-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button className="pf-accept-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ClubCard({ club, expanded, onExpand, onClose, isFav, onToggleFav, onAuthRequired, publicAccountId, markerColor, onShowRoute, routeActive, routeLoading }) {
  const open       = isOpenNow(club)
  const todayHours = getTodayHours(club)
  const todayIdx   = getTodayIdx()
  const condensed  = buildCondensedHours(club)
  const photos     = club.photo_urls || []
  const isLoggedIn = !!publicAccountId
  const owners = [
    club.first_name && `${club.first_name}${club.last_name ? ' ' + club.last_name : ''}`,
    club.owner2_first_name && `${club.owner2_first_name}${club.owner2_last_name ? ' ' + club.owner2_last_name : ''}`,
    club.owner3_first_name && `${club.owner3_first_name}${club.owner3_last_name ? ' ' + club.owner3_last_name : ''}`,
  ].filter(Boolean)
  const fullAddress = [club.address, club.city, club.state, club.zip].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`

  const [noteText, setNoteText]         = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteSent, setNoteSent]         = useState(false)
  const [noteOpen, setNoteOpen]         = useState(false)

  async function submitNote() {
    if (!noteText.trim() || !publicAccountId) return
    setNoteSubmitting(true)
    await supabase.from('club_notes').insert({ public_account_id: publicAccountId, location_id: club.id, note: noteText.trim() })
    await supabase.from('notifications').insert({ type: 'club_note', title: 'New note on a club', body: `A public user left a note on ${club.club_name || 'a club'}: "${noteText.trim().slice(0, 80)}${noteText.length > 80 ? '…' : ''}"`, user_id: null })
    setNoteSubmitting(false); setNoteSent(true); setNoteText('')
    setTimeout(() => { setNoteSent(false); setNoteOpen(false) }, 2500)
  }

  return (
    <div className={`pfp-card ${expanded ? 'pfp-card--expanded' : ''}`}>
      <div className="pfp-card-row" onClick={expanded ? onClose : onExpand}>
        <div className="pfp-card-logo" style={{ background: markerColor || '#1A3C2E' }}>
          <ClubLogo url={club.logo_url} name={club.club_name} />
        </div>
        <div className="pfp-card-info">
          <div className="pfp-card-name">{club.club_name || 'Unnamed Club'}</div>
          <div className="pfp-card-meta">
            <span className="pfp-card-city">{[club.city, club.state].filter(Boolean).join(', ')}</span>
            {club.distanceMiles != null && <span className="pfp-dist-badge">{club.distanceMiles.toFixed(1)} mi</span>}
            {todayHours && <span className={open ? 'pfp-open-badge' : 'pfp-closed-badge'}>{open ? 'Open' : 'Closed'}</span>}
          </div>
          {todayHours && <div className="pfp-card-hours">{todayHours}</div>}
        </div>
        <div className="pfp-card-actions" onClick={e => e.stopPropagation()}>
          {(onToggleFav || onAuthRequired) && (
            <button className={`pfp-heart-btn ${isFav ? 'fav' : ''}`} onClick={() => onToggleFav ? onToggleFav() : onAuthRequired?.()}>
              <HeartIcon filled={isFav} />
            </button>
          )}
          <svg className={`pfp-chevron ${expanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="pfp-detail">
          {club.address && (
            <div className="pfp-detail-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="10" r="3" stroke="#888" strokeWidth="1.5"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#888" strokeWidth="1.5"/></svg>
              <span>{fullAddress}</span>
            </div>
          )}
          {condensed.length > 0 && (
            <div className="pfp-detail-row pfp-detail-row--top">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:2}}><circle cx="12" cy="12" r="9" stroke="#888" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <div className="pfp-hours-grid">
                {condensed.map((r, i) => {
                  const isToday = todayIdx >= r.idxStart && todayIdx <= r.idxEnd
                  return (
                    <div key={i} className={`pfp-hours-row${isToday ? ' pfp-hours-today' : ''}`}>
                      <span className="pfp-hours-day">{r.day}</span>
                      <span>{r.hours}</span>
                      {isToday && <span className="pfp-today-dot">●</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {club.club_website && (
            <div className="pfp-detail-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><circle cx="12" cy="12" r="9" stroke="#888" strokeWidth="1.5"/><path d="M2 12h20M12 2c-2.5 3-4 6-4 10s1.5 7 4 10M12 2c2.5 3 4 6 4 10s-1.5 7-4 10" stroke="#888" strokeWidth="1.5"/></svg>
              <a href={club.club_website.startsWith('http') ? club.club_website : `https://${club.club_website}`} target="_blank" rel="noopener noreferrer" className="pfp-link">{club.club_website.replace(/^https?:\/\//, '')}</a>
            </div>
          )}
          {isLoggedIn && club.club_phone && (
            <div className="pfp-detail-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.93 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.84 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 5.61 5.61l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="#888" strokeWidth="1.5"/></svg>
              <span>{club.club_phone}</span>
            </div>
          )}
          {isLoggedIn && owners.length > 0 && (
            <div className="pfp-detail-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#888" strokeWidth="1.5"/><circle cx="12" cy="7" r="4" stroke="#888" strokeWidth="1.5"/></svg>
              <span>{owners.join(', ')}</span>
            </div>
          )}
          {isLoggedIn && photos.length > 0 && (
            <div className="pfp-photo-strip">
              {photos.slice(0, 4).map((url, i) => (
                <div key={i} className="pfp-photo-cell"><img src={url} alt="" /></div>
              ))}
            </div>
          )}
          {!isLoggedIn && (owners.length > 0 || club.club_phone || photos.length > 0) && (
            <div className="pfp-teaser-row">
              <div className="pfp-teaser-blurred">
                {club.club_phone && <span className="pfp-teaser-item">{club.club_phone}</span>}
                {owners.length > 0 && <span className="pfp-teaser-item">{owners[0]}</span>}
                {photos.length > 0 && <span className="pfp-teaser-item">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>}
              </div>
              <button className="pfp-teaser-btn" onClick={() => onAuthRequired?.()}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="3" y="7.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7.5V5a3 3 0 016 0v2.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Sign in to view
              </button>
            </div>
          )}
          {isLoggedIn && (
            <div className="pfp-note-section">
              {!noteOpen && !noteSent && (
                <button className="pfp-note-toggle" onClick={() => setNoteOpen(true)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Leave a note
                </button>
              )}
              {noteOpen && !noteSent && (
                <div className="pfp-note-form">
                  <textarea className="pf-note-input" rows={2} placeholder="Share your experience…" value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
                  <div className="pf-note-actions">
                    <button className="pf-note-cancel" onClick={() => { setNoteOpen(false); setNoteText('') }}>Cancel</button>
                    <button className="pf-note-submit" onClick={submitNote} disabled={noteSubmitting || !noteText.trim()}>{noteSubmitting ? 'Sending…' : 'Submit'}</button>
                  </div>
                </div>
              )}
              {noteSent && <div className="pf-note-sent">Note submitted — thank you!</div>}
            </div>
          )}
          <a className="pfp-directions-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 12l18-9-9 18-2-8-7-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            Get directions in Google Maps
          </a>
          <ShareLocationButton club={club} className="pfp-share-btn" />
          {onShowRoute && (
            <button
              className={`pfp-route-btn ${routeActive ? 'pfp-route-btn--active' : ''}`}
              onClick={onShowRoute}
              disabled={routeLoading}
            >
              {routeLoading ? (
                <><div className="pfp-route-spinner" /> Calculating route…</>
              ) : routeActive ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> Hide route</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 18h1c1 0 2-.5 2.5-1.5L8 14l2 2 3-4 2.5 3 1.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="4" y="7" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
                  <rect x="5" y="8.5" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.3"/>
                  <rect x="9" y="8.5" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.3"/>
                </svg> Show driving route</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function PublicFinderPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Owner coming from /app/map — skip disclaimer and pre-set map extent
  const fromOwner = searchParams.get('owner') === '1'
  const initLat   = parseFloat(searchParams.get('lat'))
  const initLng   = parseFloat(searchParams.get('lng'))
  const initZoom  = parseInt(searchParams.get('zoom')) || 11
  const hasInitCoords = !isNaN(initLat) && !isNaN(initLng)
  const [settings, setSettings]             = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [accepted, setAccepted]             = useState(fromOwner || hasInitCoords) // owners & landing search bypass disclaimer
  const [dismissing, setDismissing]         = useState(false)
  const [flyTo, setFlyTo] = useState(
    hasInitCoords
      ? { lat: initLat, lng: initLng, zoom: initZoom, _t: Date.now() }
      : null
  )
  const [publicAccount, setPublicAccount]   = useState(null)
  const [authModal, setAuthModal]           = useState(null)
  const [authLoading, setAuthLoading]       = useState(true)
  const [markerColors, setMarkerColors]     = useState({})
  const [finderSizeScale, setFinderSizeScale] = useState(1)
  const [query, setQuery]                   = useState('')
  const [searching, setSearching]           = useState(false)
  const [geoLocating, setGeoLocating]       = useState(false)
  const [geoError, setGeoError]             = useState('')
  const [userLat, setUserLat]               = useState(null)
  const [userLng, setUserLng]               = useState(null)
  const [results, setResults]               = useState(null)
  const [resultsFallback, setResultsFallback] = useState(false)
  const [expandedId, setExpandedId]         = useState(null)
  const [hoveredId, setHoveredId]           = useState(null)
  const [panelOpen, setPanelOpen]           = useState(false)
  const [routeCoords, setRouteCoords]       = useState(null)   // [[lat,lng], ...]
  const [routeClubId, setRouteClubId]       = useState(null)   // which club the route is for
  const [routeLoading, setRouteLoading]     = useState(false)
  const [favIds, setFavIds]                 = useState(new Set())
  const [savedClubs, setSavedClubs]         = useState([])
  const [isClubOwner, setIsClubOwner]       = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: s }, session] = await Promise.all([
        supabase.from('app_settings').select('public_search_enabled,public_accounts_enabled,public_login_enabled,public_finder_welcome,public_finder_disclaimer_enabled,public_finder_disclaimer,search_radius_miles,marker_color_own,marker_color_other,marker_color_selected,global_marker_size').eq('id', 1).single(),
        supabase.auth.getSession(),
      ])
      setSettings(s)
      if (s) setMarkerColors({ own: s.marker_color_own, other: s.marker_color_other, selected: s.marker_color_selected })
      if (s?.global_marker_size) setFinderSizeScale(s.global_marker_size === 'large' ? 1.5 : s.global_marker_size === 'medium' ? 1.25 : 1)
      if (session.data.session) {
        const userId = session.data.session.user.id
        // Check if this is a public account or a club owner
        const { data: pubAcct } = await supabase.from('public_accounts').select('id').eq('auth_user_id', userId).single()
        if (pubAcct) {
          await loadPublicAccount(userId)
        } else {
          // Has a session but no public_accounts row → club owner or admin
          setIsClubOwner(true)
        }
      }
      setAuthLoading(false)
      setLoadingSettings(false)
    }
    load()
  }, [])

  // Auto-geolocate on entry when no URL params provided
  const autoGeoFired = useRef(false)
  useEffect(() => {
    if (autoGeoFired.current) return
    if (fromOwner) return  // owner already has coords from URL
    if (hasInitCoords) return  // landing page search already has coords
    if (!accepted) return  // wait until disclaimer is accepted
    autoGeoFired.current = true
    handleGeolocate()
  }, [accepted])

  async function loadPublicAccount(authUserId) {
    const { data } = await supabase.from('public_accounts').select('id,display_name,email').eq('auth_user_id', authUserId).single()
    if (data) { setPublicAccount(data); await loadFavorites(data.id) }
  }

  async function loadFavorites(accountId) {
    const { data } = await supabase
      .from('public_favorites')
      .select('location_id, locations(id,club_name,address,city,state,zip,lat,lng,logo_url,club_website,club_phone,club_email,first_name,last_name,owner2_first_name,owner2_last_name,photo_urls,hours_monday_open,hours_monday_close,hours_tuesday_open,hours_tuesday_close,hours_wednesday_open,hours_wednesday_close,hours_thursday_open,hours_thursday_close,hours_friday_open,hours_friday_close,hours_saturday_open,hours_saturday_close,hours_sunday_open,hours_sunday_close)')
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
    setPublicAccount(null); setFavIds(new Set()); setSavedClubs([])
  }

  async function geocodeAddress(address) {
    return geocodeSingle(address)
  }

  async function doSearch(lat, lng) {
    setSearching(true); setExpandedId(null)
    const radius = Math.abs(settings?.search_radius_miles ?? 20)
    const mapDist = rows => (rows || []).map(r => ({ ...r, distanceMiles: r.distance_miles }))
    const { data: nearby, error } = await supabase.rpc('nearby_clubs', { search_lat: lat, search_lng: lng, radius_miles: radius })
    if (error) { console.error('nearby_clubs error:', error); setSearching(false); return }
    let displayResults
    if (nearby && nearby.length > 0) {
      displayResults = mapDist(nearby).slice(0, 25)
      setResults(displayResults); setResultsFallback(false)
    } else {
      const { data: fallback } = await supabase.rpc('nearby_clubs', { search_lat: lat, search_lng: lng, radius_miles: 99999 })
      displayResults = mapDist(fallback).slice(0, 5)
      setResults(displayResults); setResultsFallback(true)
    }
    setPanelOpen(true); setSearching(false)
    // Fit map to show user location + all result pins
    const pts = [[lat, lng]]
    displayResults.forEach(c => { if (c.lat && c.lng) pts.push([c.lat, c.lng]) })
    if (pts.length > 1) {
      setFlyTo({ bounds: pts, _t: Date.now() })
    } else {
      setFlyTo({ lat, lng, zoom: 13, _t: Date.now() })
    }
  }

  async function handleSearchSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setGeoError('')
    const coords = await geocodeAddress(query.trim())
    if (!coords) { setGeoError('Address not found. Try a city, place name, or zip code.'); return }
    setUserLat(coords.lat); setUserLng(coords.lng)
    doSearch(coords.lat, coords.lng)
  }

  function handleGeolocate() {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported by your browser.'); return }
    setGeoLocating(true); setGeoError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setUserLat(latitude); setUserLng(longitude); setGeoLocating(false)
        doSearch(latitude, longitude)
      },
      () => { setGeoError('Could not get your location. Try entering an address.'); setGeoLocating(false) }
    )
  }

  function handleCardExpand(id) {
    setExpandedId(id)
    if (id !== routeClubId) { setRouteCoords(null); setRouteClubId(null) }
    const club = results?.find(r => r.id === id)
    if (!club?.lat || !club?.lng) return
    // If we have user location, fit both points in view; otherwise just fly to club
    if (userLat && userLng) {
      const bounds = [[userLat, userLng], [club.lat, club.lng]]
      setFlyTo({ bounds, _t: Date.now() })
    } else {
      setFlyTo({ lat: club.lat, lng: club.lng, zoom: 14, _t: Date.now() })
    }
  }

  function handlePinClick(id) {
    setExpandedId(id); setPanelOpen(true)
    if (id !== routeClubId) { setRouteCoords(null); setRouteClubId(null) }
    const club = results?.find(r => r.id === id)
    if (!club?.lat || !club?.lng) return
    if (userLat && userLng) {
      const bounds = [[userLat, userLng], [club.lat, club.lng]]
      setFlyTo({ bounds, _t: Date.now() })
    } else {
      setFlyTo({ lat: club.lat, lng: club.lng, zoom: 14, _t: Date.now() })
    }
    setTimeout(() => document.getElementById(`pfp-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150)
  }

  async function fetchRoute(club) {
    if (!userLat || !userLng || !club.lat || !club.lng) return
    if (routeClubId === club.id && routeCoords) { setRouteCoords(null); setRouteClubId(null); return }
    setRouteLoading(true)
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${club.lng},${club.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      const res  = await fetch(url)
      const data = await res.json()
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRouteCoords(coords)
        setRouteClubId(club.id)
        // Fit map to show full route
        if (coords.length > 1) {
          const lats = coords.map(c => c[0]), lngs = coords.map(c => c[1])
          const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
          setFlyTo({ bounds, _t: Date.now() })
        }
      }
    } catch {}
    setRouteLoading(false)
  }

  if (loadingSettings || authLoading) return <div className="loading">Loading…</div>

  if (!settings?.public_search_enabled) {
    return (
      <div className="pf-page">
        <div className="pf-closed">
          <div className="pf-closed-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#1A3C2E"/></svg></div>
          <h1 className="pf-closed-title">Club Finder</h1>
          <p className="pf-closed-msg">The club finder is not available right now. Please check back soon.</p>
          <button className="pf-back-btn-plain" onClick={() => navigate('/')}>← Back to home</button>
        </div>
      </div>
    )
  }

  const showDisclaimer = settings?.public_finder_disclaimer_enabled && !accepted

  const pinColor  = markerColors.other    || '#6B8DD6'
  const selColor  = markerColors.selected || '#F59E0B'
  const userIcon  = makeUserIcon(finderSizeScale)

  return (
    <div className="pfp-page">
      <div className="pfp-topbar">
        {!isClubOwner && (
          <button className="pfp-back-btn" onClick={() => navigate('/')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
        )}
        <div className="pfp-brand">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
          My Club Locator
        </div>
        <div className="pfp-auth-zone">
          {isClubOwner ? (
            <button className="pfp-auth-link pfp-auth-link--accent" onClick={() => {
              // Pass current /find extent back to /map
              const ext = sessionStorage.getItem('findExtent')
              if (ext) sessionStorage.setItem('mapReturnExtent', ext)
              navigate('/app/map')
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Return to Owner map
            </button>
          ) : publicAccount ? (
            <>
              <span className="pfp-auth-name">Hi, {publicAccount.display_name || publicAccount.email?.split('@')[0]}</span>
              <button className="pfp-auth-link" onClick={handleSignOut}>Sign out</button>
            </>
          ) : settings?.public_accounts_enabled !== false ? (
            <>
              <button className="pfp-auth-link" onClick={() => setAuthModal('signin')}>Sign in</button>
              <button className="pfp-auth-link pfp-auth-link--accent" onClick={() => setAuthModal('signup')}>Create account</button>
            </>
          ) : null}
        </div>
      </div>

      <div className={`pfp-body ${showDisclaimer ? 'pfp-body--blurred' : ''}`}>
        {/* Map — full size, behind everything */}
        <div className="pfp-map-wrap">
          <MapContainer
            center={hasInitCoords ? [initLat, initLng] : [39.5, -98.35]}
            zoom={hasInitCoords ? initZoom : 4}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer url={MAPBOX_URL} attribution={MAPBOX_ATTR} />
            <FindExtentTracker />
            {flyTo && <MapFlyTo key={flyTo._t} lat={flyTo.lat} lng={flyTo.lng} zoom={flyTo.zoom} bounds={flyTo.bounds} />}
            {userLat && userLng && <Marker position={[userLat, userLng]} icon={userIcon} />}
          {routeCoords && (
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: '#185FA5', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
            />
          )}
            {(results || []).map(club => {
              if (!club.lat || !club.lng) return null
              const isSelected = club.id === expandedId
              const isHovered  = club.id === hoveredId
              const icon = makeClubIcon(isSelected ? 'selected' : 'other', isSelected ? selColor : pinColor, isHovered, finderSizeScale)
              return (
                <Marker
                  key={club.id}
                  position={[club.lat, club.lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => handlePinClick(club.id),
                    mouseover: () => {
                      setHoveredId(club.id)
                      document.getElementById(`pfp-card-${club.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    },
                    mouseout: () => setHoveredId(null),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -14]} className="pfp-pin-tooltip">
                    {club.club_name || 'Club'}
                  </Tooltip>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Overlay layer — sits above the map, pointer-events only where needed */}
        {!showDisclaimer && (
        <div className="pfp-overlay">
          {/* Search box */}
          <div className="pfp-search-float">
            <form className="pfp-search-form" onSubmit={handleSearchSubmit}>
              <div className="pfp-search-row">
                <AddressAutocomplete
                  value={query}
                  onChange={setQuery}
                  onSelect={({ street, city, state, zip, lat, lng }) => {
                    const full = [street, city, state, zip].filter(Boolean).join(', ')
                    setQuery(full); setGeoError('')
                    setUserLat(lat); setUserLng(lng)
                    doSearch(lat, lng)
                  }}
                />
                <button className="pfp-search-btn" type="submit" disabled={searching}>
                  {searching ? <div className="pfp-search-spinner" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                </button>
              </div>
            </form>
            <button className="pfp-geo-btn" onClick={handleGeolocate} disabled={geoLocating}>
              {geoLocating ? <div className="pfp-search-spinner" style={{width:12,height:12}} /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/></svg>}
              {geoLocating ? 'Locating…' : 'Use my location'}
            </button>
            {geoError && <div className="pfp-geo-error">{geoError}</div>}
          </div>

          {/* Results panel */}
          {results !== null && (
            <div className={`pfp-panel ${panelOpen ? 'pfp-panel--open' : 'pfp-panel--collapsed'}`}>
              <div className="pfp-panel-header" onClick={() => setPanelOpen(o => !o)}>
                <span className="pfp-panel-count">
                  {resultsFallback
                    ? <span className="pfp-fallback-text">No clubs within {Math.abs(settings?.search_radius_miles ?? 20)} mi — showing nearest</span>
                    : <>{results.length} club{results.length !== 1 ? 's' : ''} found nearby</>
                  }
                </span>
                <svg className="pfp-panel-chevron" width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d={panelOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {panelOpen && (
                <div className="pfp-panel-list">
                  {results.map(club => (
                    <div key={club.id} id={`pfp-card-${club.id}`}
                      className={hoveredId === club.id && expandedId !== club.id ? 'pfp-card-highlight' : ''}
                      onMouseEnter={() => setHoveredId(club.id)}
                      onMouseLeave={() => setHoveredId(null)}>
                      <ClubCard
                        club={club}
                        expanded={expandedId === club.id}
                        onExpand={() => handleCardExpand(club.id)}
                        onClose={() => setExpandedId(null)}
                        isFav={favIds.has(club.id)}
                        onToggleFav={publicAccount ? () => toggleFavorite(club.id) : undefined}
                        onAuthRequired={!publicAccount && settings?.public_accounts_enabled !== false ? () => setAuthModal('signin') : undefined}
                        publicAccountId={publicAccount?.id}
                        markerColor={club.id === expandedId ? selColor : pinColor}
                        onShowRoute={userLat && userLng ? () => fetchRoute(club) : undefined}
                        routeActive={routeClubId === club.id && !!routeCoords}
                        routeLoading={routeLoading && routeClubId === club.id}
                      />
                    </div>
                  ))}
                  <div className="pfp-panel-footer">
                    {isClubOwner ? (
                      <button
                        onClick={() => {
                          const ext = sessionStorage.getItem('findExtent')
                          if (ext) sessionStorage.setItem('mapReturnExtent', ext)
                          navigate('/app/map')
                        }}
                        className="pfp-panel-footer-owner-btn"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Return to Owner map
                      </button>
                    ) : (
                      <>
                        <span>Club owner?</span>
                        <button onClick={() => navigate('/login')} className="pfp-footer-link">Log in to manage your club →</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-search hint */}
          {results === null && !searching && (
            <div className="pfp-map-hint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              {settings?.public_finder_welcome || 'Find a nutrition club near you'}
            </div>
          )}
        </div>
        )}

        {/* Disclaimer overlay — sits above blurred map */}
        {showDisclaimer && (
          <DisclaimerScreen text={settings.public_finder_disclaimer} onAccept={() => setAccepted(true)} />
        )}
      </div>

      {authModal && (
        <AuthModal mode={authModal} settings={settings} onSuccess={handleAuthSuccess} onClose={() => setAuthModal(null)} />
      )}
    </div>
  )
}
