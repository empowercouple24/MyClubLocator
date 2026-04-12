import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import DemographicsPanel from '../components/DemographicsPanel'
import MapSearchAutocomplete from '../components/MapSearchAutocomplete'
import PhotoGallery from '../components/PhotoGallery'

delete L.Icon.Default.prototype._getIconUrl

// ── Circle markers via DivIcon ────────────────────────────
// own = warm red, other = periwinkle blue, selected = gold
// Each has a white stroke on light map, white stroke on aerial
function makeCircleIcon(type) {
  const configs = {
    own:      { fill: '#D94F4F', stroke: '#a83535', size: 22 },
    other:    { fill: '#6B8DD6', stroke: '#4060b0', size: 18 },
    selected: { fill: '#F59E0B', stroke: '#c47d00', size: 26 },
  }
  const { fill, stroke, size } = configs[type]
  const r = size / 2
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${fill}" stroke="white" stroke-width="2"/></svg>`
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [r, r],
    popupAnchor: [0, -r],
  })
}

const ownIcon      = makeCircleIcon('own')
const otherIcon    = makeCircleIcon('other')
const selectedIcon = makeCircleIcon('selected')

const BASE_MAPS = [
  { id: 'carto',     label: 'Clean',  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  { id: 'satellite', label: 'Aerial', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
]

const RADIUS_PRESETS = [3, 10, 20, 30]
const PANEL_POSITIONS = ['right', 'left', 'bottom']

function milesToMeters(m) { return m * 1609.34 }

function formatPhone(raw) {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return raw
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatHoursDisplay(loc) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const rows = []
  days.forEach((d, i) => {
    const o = loc[`hours_${d}_open`], c = loc[`hours_${d}_close`]
    if (o && c) {
      const fmt = t => {
        const [h, m] = t.split(':').map(Number)
        const period = h < 12 ? 'AM' : 'PM'
        const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${hour}:${String(m).padStart(2,'0')} ${period}`
      }
      rows.push({ day: labels[i], hours: `${fmt(o)} – ${fmt(c)}` })
    }
  })
  return rows
}

function MapClickHandler({ onMapClick, active }) {
  const map = useMap()
  useEffect(() => {
    if (!active) return
    function handler(e) { onMapClick(e.latlng.lat, e.latlng.lng) }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [active, map])
  return null
}

function MapController({ center, zoom, panelPosition }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      setTimeout(() => {
        map.invalidateSize()
        map.setView(center, zoom || map.getZoom(), { animate: true })
      }, 320)
    }
  }, [center, zoom])
  useEffect(() => { setTimeout(() => map.invalidateSize(), 320) }, [panelPosition])
  return null
}

function MapRefCapture({ mapRef }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map])
  return null
}

function ClubMarkers({ locations, selectedId, userId, onSelect, navigate }) {
  const map = useMap()
  const markersRef = useRef({})

  useEffect(() => {
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    locations.forEach(loc => {
      const isOwn      = loc.user_id === userId
      const isSelected = loc.id === selectedId
      const icon = isSelected ? selectedIcon : (isOwn ? ownIcon : otherIcon)

      // ── Owner rows with photo or initials ──
      const ownerRows = [
        { name: [loc.first_name, loc.last_name].filter(Boolean).join(' '), photo: loc.owner_photo_url },
        { name: [loc.owner2_first_name, loc.owner2_last_name].filter(Boolean).join(' '), photo: loc.owner2_photo_url },
        { name: [loc.owner3_first_name, loc.owner3_last_name].filter(Boolean).join(' '), photo: loc.owner3_photo_url },
      ].filter(o => o.name)

      const ownerHtml = ownerRows.map(o => {
        const initials = o.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
        const avatar = o.photo
          ? `<img src="${o.photo}" class="ct-owner-photo" alt="${o.name}" />`
          : `<div class="ct-owner-initials">${initials}</div>`
        return `<div class="ct-owner-row">${avatar}<span class="ct-owner-name">${o.name}</span></div>`
      }).join('')

      // ── Logo or initials ──
      const logoHtml = loc.logo_url
        ? `<img src="${loc.logo_url}" class="ct-logo-img" alt="logo" />`
        : `<div class="ct-logo-initials">${(loc.club_name || 'CL').slice(0,2).toUpperCase()}</div>`

      // ── Level pill ──
      const condenseLvl = (l) => {
        if (!l) return ''
        return l
          .replace('Presidents Team', 'PT').replace('Chairmans Club', 'CC')
          .replace('Founders Circle', 'FC').replace('Millionaire Team 7500', 'MP')
          .replace('Millionaire Team', 'MT').replace('Get Team 2500', 'GP')
          .replace('Get Team', 'GT').replace('Active World Team', 'AWT')
          .replace('World Team', 'WT').replace('Supervisor', 'SP')
          .replace('Success Builder', 'SB').replace('Distributor', 'DS')
      }
      const levelLabel = condenseLvl(loc.herbalife_level)
      const levelHtml = levelLabel
        ? `<div class="ct-level-pill">${levelLabel.replace(/ (\d+) 💎$/, ' $1 💎')}</div>`
        : ''

      // ── Address ──
      const addrParts = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean)
      const addrHtml = addrParts.length
        ? `<div class="ct-addr">${addrParts.join(', ')}</div>`
        : ''

      // ── Condensed hours ──
      const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      const formatT = t => {
        if (!t) return ''
        const [h, m] = t.split(':').map(Number)
        const p = h < 12 ? 'AM' : 'PM'
        const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${hr}:${String(m).padStart(2,'0')} ${p}`
      }
      const openDays = DAYS.map((d,i) => ({
        label: DAY_LABELS[i], open: !!(loc[`hours_${d}_open`] && loc[`hours_${d}_close`]),
        o: loc[`hours_${d}_open`] || '', c: loc[`hours_${d}_close`] || ''
      })).filter(d => d.open)

      let hoursHtml = ''
      if (openDays.length) {
        const ranges = []
        let run = [openDays[0]]
        for (let i = 1; i < openDays.length; i++) {
          const prev = run[run.length-1], curr = openDays[i]
          const prevIdx = DAYS.indexOf(DAYS.find((_,j) => DAY_LABELS[j] === prev.label))
          const currIdx = DAYS.indexOf(DAYS.find((_,j) => DAY_LABELS[j] === curr.label))
          if (currIdx === prevIdx + 1 && prev.o === curr.o && prev.c === curr.c) run.push(curr)
          else { ranges.push(run); run = [curr] }
        }
        ranges.push(run)
        const hoursLines = ranges.map(r => {
          const lbl = r.length === 1 ? r[0].label : `${r[0].label}–${r[r.length-1].label}`
          return `<div class="ct-hours-row"><span class="ct-hours-day">${lbl}</span><span class="ct-hours-time">${formatT(r[0].o)} – ${formatT(r[0].c)}</span></div>`
        }).join('')
        hoursHtml = `<div class="ct-hours-block">${hoursLines}</div>`
      }

      // ── Open since ──
      const sinceHtml = loc.opened_month && loc.opened_year
        ? `<div class="ct-since">Since ${loc.opened_month} ${loc.opened_year}</div>` : ''

      // ── Directory link ──
      const dirLink = `<div class="ct-dir-link" data-clubname="${encodeURIComponent(loc.club_name || '')}">View in directory →</div>`

      const tooltipHtml = `
        <div class="ct-inner">
          <div class="ct-header">
            ${logoHtml}
            <div class="ct-header-text">
              <div class="ct-name">${loc.club_name || 'Unnamed Club'}</div>
              ${levelHtml}
            </div>
          </div>
          ${ownerHtml}
          ${addrHtml}
          ${hoursHtml}
          ${sinceHtml}
          ${dirLink}
        </div>`

      const tooltip = L.tooltip({
        permanent: false,
        direction: 'top',
        offset: [0, -28],
        className: 'club-tooltip',
      }).setContent(tooltipHtml)

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindTooltip(tooltip)
        .on('click', () => onSelect(loc))
        .on('tooltipopen', () => {
          // Attach directory link click after tooltip renders
          setTimeout(() => {
            const el = document.querySelector('.ct-dir-link')
            if (el) {
              el.addEventListener('click', (e) => {
                e.stopPropagation()
                const name = decodeURIComponent(el.dataset.clubname || '')
                navigate(`/app/directory?search=${encodeURIComponent(name)}`)
              })
            }
          }, 50)
        })

      markersRef.current[loc.id] = marker
    })

    return () => { Object.values(markersRef.current).forEach(m => m.remove()); markersRef.current = {} }
  }, [locations, selectedId, userId])

  return null
}

// ── My Club pinned card ─────────────────────────────────────
function MyClubCard({ myClub, onManage }) {
  if (!myClub) {
    return (
      <div className="my-club-card my-club-empty">
        <div className="mcc-icon">📍</div>
        <div>
          <div className="mcc-name">Your Club</div>
          <button className="mcc-setup-btn" onClick={onManage}>Set up your club →</button>
        </div>
      </div>
    )
  }
  return (
    <div className="my-club-card">
      {myClub.logo_url
        ? <img src={myClub.logo_url} alt="logo" className="mcc-logo" />
        : <div className="mcc-initials">{(myClub.club_name || 'MC').slice(0,2).toUpperCase()}</div>
      }
      <div className="mcc-info">
        <div className="mcc-name">{myClub.club_name || 'Your Club'}</div>
        {myClub.city && <div className="mcc-loc">{myClub.city}{myClub.state ? `, ${myClub.state}` : ''}</div>}
        {myClub.opened_month && myClub.opened_year && (
          <div className="mcc-since">Since {myClub.opened_month} {myClub.opened_year}</div>
        )}
      </div>
      <button className="mcc-edit-btn" onClick={onManage} title="Manage my club">✏️</button>
    </div>
  )
}

// ── Club detail panel content ───────────────────────────────
function ClubDetail({ club, userId, onManage, radiusMiles, setRadiusMiles, customMiles, setCustomMiles, filteredCount, setGalleryPhotos }) {
  if (!club) {
    return (
      <div className="cp-empty">
        <div className="cp-empty-icon">🗺</div>
        <div className="cp-empty-text">Select a club on the map to view its details</div>
      </div>
    )
  }

  const isOwn = club.user_id === userId
  const hourRows = formatHoursDisplay(club)
  const ownerName = [club.first_name, club.last_name].filter(Boolean).join(' ')
  const owner2Name = [club.owner2_first_name, club.owner2_last_name].filter(Boolean).join(' ')
  const owner3Name = [club.owner3_first_name, club.owner3_last_name].filter(Boolean).join(' ')

  const owners = [
    { name: ownerName,  photo: club.owner_photo_url },
    { name: owner2Name, photo: club.owner2_photo_url },
    { name: owner3Name, photo: club.owner3_photo_url },
  ].filter(o => o.name)

  return (
    <>
      {/* Club header */}
      <div className="cp-header">
        <div className="cp-header-left">
          {club.logo_url
            ? <img src={club.logo_url} alt="logo" className="cp-logo" />
            : <div className="cp-initials">{(club.club_name || 'CL').slice(0,2).toUpperCase()}</div>
          }
          <div>
            <h2 className="cp-name">{club.club_name || 'Unnamed Club'}</h2>
            {club.city && <p className="cp-location">{club.city}{club.state ? `, ${club.state}` : ''}</p>}
            {club.opened_month && club.opened_year && (
              <p className="cp-since">Open since {club.opened_month} {club.opened_year}</p>
            )}
          </div>
        </div>
      </div>

      {/* Own club CTA */}
      {isOwn && (
        <button className="cp-manage-btn" onClick={onManage}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <span>
            <strong>Manage My Club</strong>
            <small>{club.club_name || 'Your Club'}</small>
          </span>
        </button>
      )}

      {/* Owners */}
      {owners.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-title">Owners</div>
          {owners.map((o, i) => (
            <div key={i} className="cp-row cp-owner-row">
              <div className="cp-owner-avatar">
                {o.photo
                  ? <img src={o.photo} alt={o.name} className="cp-owner-photo" />
                  : <span className="cp-icon">👤</span>
                }
              </div>
              <span>{o.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contact */}
      <div className="cp-section">
        <div className="cp-section-title">Contact</div>
        {club.address && <div className="cp-row"><span className="cp-icon">📍</span><span>{club.address}{club.city ? `, ${club.city}` : ''}</span></div>}
        {club.club_phone && <div className="cp-row"><span className="cp-icon">📞</span><a href={`tel:${club.club_phone}`}>{formatPhone(club.club_phone)}</a></div>}
        {club.club_email && <div className="cp-row"><span className="cp-icon">✉️</span><span className="cp-email-plain">{club.club_email}</span></div>}
        {club.website && <div className="cp-row"><span className="cp-icon">🌐</span><a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noreferrer">{club.website}</a></div>}
      </div>

      {/* Hours */}
      {hourRows.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-title">Hours</div>
          <div className="cp-hours-grid">
            {hourRows.map(r => (
              <div key={r.day} className="cp-hours-row">
                <span className="cp-hours-day">{r.day}</span>
                <span className="cp-hours-time">{r.hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social */}
      {(club.social_facebook || club.social_instagram || club.social_tiktok || club.social_youtube) && (
        <div className="cp-section">
          <div className="cp-section-title">Social</div>
          <div className="cp-socials">
            {club.social_facebook  && <a href={club.social_facebook}  target="_blank" rel="noreferrer" className="cp-social-link">Facebook</a>}
            {club.social_instagram && <a href={club.social_instagram} target="_blank" rel="noreferrer" className="cp-social-link">Instagram</a>}
            {club.social_tiktok    && <a href={club.social_tiktok}    target="_blank" rel="noreferrer" className="cp-social-link">TikTok</a>}
            {club.social_youtube   && <a href={club.social_youtube}   target="_blank" rel="noreferrer" className="cp-social-link">YouTube</a>}
          </div>
        </div>
      )}

      {/* Photos */}
      {club.photo_urls && club.photo_urls.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-title">Photos</div>
          <div className="cp-photos-grid">
            {/* Cover photo — large, clickable */}
            <div className="cp-photo-cover" onClick={() => setGalleryPhotos({ photos: club.photo_urls, start: 0 })}>
              <img src={club.photo_urls[0]} alt="Club cover" className="cp-photo-cover-img" />
              {club.photo_urls.length > 1 && (
                <div className="cp-photo-cover-overlay">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="1" width="9" height="7" rx="1.5" stroke="white" strokeWidth="1.2"/>
                    <rect x="6" y="8" width="9" height="7" rx="1.5" stroke="white" strokeWidth="1.2"/>
                  </svg>
                  {club.photo_urls.length} photos
                </div>
              )}
            </div>
            {/* Smaller thumbs */}
            {club.photo_urls.length > 1 && (
              <div className="cp-photo-thumbs">
                {club.photo_urls.slice(1, 5).map((url, i) => (
                  <div key={i} className="cp-photo-thumb" onClick={() => setGalleryPhotos({ photos: club.photo_urls, start: i + 1 })}>
                    <img src={url} alt={`Photo ${i + 2}`} />
                    {i === 3 && club.photo_urls.length > 5 && (
                      <div className="cp-photo-more">+{club.photo_urls.length - 5}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Radius */}
      <div className="cp-section cp-radius-section">
        <div className="cp-section-title">Nearby Clubs</div>
        <p className="cp-radius-hint">Show clubs within a radius of this location</p>
        <div className="radius-presets">
          {RADIUS_PRESETS.map(m => (
            <button key={m}
              className={`radius-preset-btn ${radiusMiles === m ? 'active' : ''}`}
              onClick={() => setRadiusMiles(radiusMiles === m ? null : m)}>
              {m} mi
            </button>
          ))}
        </div>
        <div className="radius-custom">
          <input type="number" min="0.5" max="50" step="0.5"
            placeholder="Custom mi" value={customMiles}
            onChange={e => setCustomMiles(e.target.value)} />
          <button className="radius-preset-btn"
            onClick={() => { if (customMiles) setRadiusMiles(parseFloat(customMiles)) }}
            disabled={!customMiles}>Apply</button>
        </div>
        {radiusMiles && (
          <div className="radius-result">{filteredCount} club{filteredCount !== 1 ? 's' : ''} within {radiusMiles} mi</div>
        )}
      </div>
    </>
  )
}

// ── Main MapPage ────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [galleryPhotos, setGalleryPhotos] = useState(null) // null = closed, array = open
  const [baseMap, setBaseMap]       = useState('carto')
  const [mapCenter, setMapCenter]   = useState(null)
  const [mapZoom, setMapZoom]       = useState(null)
  const [citySearch, setCitySearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [geocoding, setGeocoding]   = useState(false)
  const [radiusMiles, setRadiusMiles] = useState(null)
  const [customMiles, setCustomMiles] = useState('')
  const [saveViewToast, setSaveViewToast] = useState(false)
  const [myClubCollapsed, setMyClubCollapsed] = useState(true)
  const mapRef = useRef(null)
  const mapAreaRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 })

  // Demographics
  const [demoActive, setDemoActive]   = useState(false)
  const [demoLat, setDemoLat]         = useState(null)
  const [demoLng, setDemoLng]         = useState(null)
  const defaultEnabledFactors = {
    population: true, income: true, ageFit: true, medianAge: true,
    poverty: true, competition: true, health: true, spending: true,
    growth: true, commute: true, competitors: true,
  }
  const [enabledFactors] = useState(defaultEnabledFactors)

  // Panel position — per user, stored in localStorage, default 'right'
  const posKey     = user ? `panel_position_${user.id}` : 'panel_position'
  const viewKey    = user ? `default_view_${user.id}`   : 'default_view'
  const [panelPosition, setPanelPosition] = useState(() => {
    return localStorage.getItem(posKey) || 'right'
  })

  function updatePanelPosition(pos) {
    setPanelPosition(pos)
    localStorage.setItem(posKey, pos)
  }

  // Load saved default view on mount (after locations load)
  const defaultViewApplied = useRef(false)
  useEffect(() => {
    if (locations.length > 0 && !defaultViewApplied.current) {
      const saved = localStorage.getItem(viewKey)
      if (saved) {
        try {
          const { lat, lng, zoom } = JSON.parse(saved)
          setMapCenter([lat, lng])
          setMapZoom(zoom)
        } catch {}
      }
      defaultViewApplied.current = true
    }
  }, [locations])

  function saveDefaultView() {
    if (!mapRef.current) return
    const center = mapRef.current.getCenter()
    const zoom   = mapRef.current.getZoom()
    localStorage.setItem(viewKey, JSON.stringify({ lat: center.lat, lng: center.lng, zoom }))
    setSaveViewToast(true)
    setTimeout(() => setSaveViewToast(false), 2500)
  }

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations').select('*').not('lat', 'is', null).not('lng', 'is', null)
        .neq('approved', false)
      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()
    const channel = supabase.channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const myClub = locations.find(l => l.user_id === user?.id) || null

  async function handleSelectClub(loc) {
    setSelected(loc)
    setRadiusMiles(null)
    setCustomMiles('')
    setMapCenter([loc.lat, loc.lng])
    setMapZoom(14)
    // Auto-load market data if demo panel is active, or activate it and load
    if (loc.lat && loc.lng) {
      setDemoActive(true)
      setDemoLat(loc.lat)
      setDemoLng(loc.lng)
    }
  }

  async function handleCitySearch(e) {
    e.preventDefault()
    if (!citySearch.trim()) { setCityFilter(''); return }
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(citySearch)}&limit=1`)
      const data = await res.json()
      if (data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        setMapZoom(11)
      }
    } catch {}
    setCityFilter(citySearch)
    setGeocoding(false)
  }

  function clearFilters() {
    setCityFilter(''); setCitySearch('')
    setRadiusMiles(null); setCustomMiles('')
    setSelected(null)
  }

  const filteredLocations = locations.filter(loc => {
    if (selected && radiusMiles) {
      const dist = getDistanceMiles(selected.lat, selected.lng, loc.lat, loc.lng)
      if (dist > radiusMiles) return false
    }
    if (cityFilter) {
      const hay = `${loc.city||''} ${loc.state||''} ${loc.address||''}`.toLowerCase()
      return hay.includes(cityFilter.toLowerCase())
    }
    return true
  })

  const activeBase = BASE_MAPS.find(b => b.id === baseMap) || BASE_MAPS[0]
  const defaultCenter = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [39.5, -98.35]
  const hasFilter = cityFilter || radiusMiles

  return (
    <div className={`map-wrapper map-pos-${panelPosition}`}>

      {/* ── Map area ── */}
      <div
        className={`map-area${demoActive ? ' demo-research-mode' : ''}`}
        ref={mapAreaRef}
        onMouseMove={e => {
          if (!demoActive) return
          const rect = e.currentTarget.getBoundingClientRect()
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }}
        onMouseLeave={() => setMousePos({ x: -999, y: -999 })}
      >
        {/* Pulsing target cursor overlay */}
        {demoActive && mousePos.x > 0 && (
          <div className="demo-cursor-pulse" style={{ left: mousePos.x, top: mousePos.y }}>
            <div className="demo-cursor-ring demo-cursor-ring--outer" />
            <div className="demo-cursor-ring demo-cursor-ring--inner" />
            <div className="demo-cursor-dot" />
          </div>
        )}

        {loading ? <div className="loading">Loading map…</div> : (
          <MapContainer center={defaultCenter} zoom={locations.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
            <MapRefCapture mapRef={mapRef} />
            <MapController center={mapCenter} zoom={mapZoom} panelPosition={panelPosition} />
            <MapClickHandler active={demoActive} onMapClick={(lat, lng) => { setDemoLat(lat); setDemoLng(lng) }} />
            <TileLayer key={activeBase.id} attribution={activeBase.attribution} url={activeBase.url} />
            <ClubMarkers locations={filteredLocations} selectedId={selected?.id} userId={user?.id} onSelect={handleSelectClub} navigate={navigate} />
            {selected && radiusMiles && (
              <Circle center={[selected.lat, selected.lng]} radius={milesToMeters(radiusMiles)}
                pathOptions={{ color: '#1A3C2E', fillColor: '#4CAF82', fillOpacity: 0.08, weight: 2 }} />
            )}
          </MapContainer>
        )}

        {/* Search toolbar */}
        <div className="map-toolbar">
          <form className="map-search-form" onSubmit={handleCitySearch}>
            <MapSearchAutocomplete
              value={citySearch}
              onChange={setCitySearch}
              geocoding={geocoding}
              onSelect={({ lat, lng, label }) => {
                setMapCenter([lat, lng])
                setMapZoom(11)
                setCityFilter(label)
              }}
              onClear={clearFilters}
            />
          </form>
          {hasFilter && <button className="map-clear-btn" onClick={clearFilters}>✕ Clear</button>}
          <button
            className={`map-demo-btn ${demoActive ? 'active' : ''}`}
            onClick={() => { setDemoActive(d => !d); if (!demoActive) { setDemoLat(null); setDemoLng(null) } }}
            title="Toggle market data">
            📊 Market Data
          </button>
        </div>

        {/* Base map + panel position toggles + default view */}
        <div className="map-controls-bottom">
          <div className="map-basemap-toggle">
            {BASE_MAPS.map(b => (
              <button key={b.id} className={`basemap-btn ${baseMap === b.id ? 'active' : ''}`} onClick={() => setBaseMap(b.id)}>{b.label}</button>
            ))}
          </div>
          <div className="map-controls-right">
            <button className="map-default-view-btn" onClick={saveDefaultView} title="Save current map view as default">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" fill="currentColor"/>
              </svg>
              Set Default View
            </button>
            <div className="map-position-toggle" title="Panel position">
              {[
                { pos: 'left',   icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.9"/><rect x="7" y="1" width="8" height="14" rx="1" fill="currentColor" opacity="0.3"/></svg>
                )},
                { pos: 'bottom', icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="9" rx="1" fill="currentColor" opacity="0.3"/><rect x="1" y="11" width="14" height="4" rx="1" fill="currentColor" opacity="0.9"/></svg>
                )},
                { pos: 'right',  icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="8" height="14" rx="1" fill="currentColor" opacity="0.3"/><rect x="10" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.9"/></svg>
                )},
              ].map(({ pos, icon }) => (
                <button key={pos} className={`position-btn ${panelPosition === pos ? 'active' : ''}`}
                  onClick={() => updatePanelPosition(pos)} title={`Panel on ${pos}`}>{icon}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="map-legend">
          <div className="legend-row">
            <span className="legend-circle legend-circle--own"></span>
            <span>Your club</span>
          </div>
          <div className="legend-row">
            <span className="legend-circle legend-circle--other"></span>
            <span>Other clubs</span>
          </div>
          <div className="legend-row">
            <span className="legend-circle legend-circle--selected"></span>
            <span>Selected</span>
          </div>
        </div>

        {/* Club count */}
        <div className="map-count">
          <strong>{filteredLocations.length}</strong>
          {hasFilter ? ` of ${locations.length}` : ''} club{filteredLocations.length !== 1 ? 's' : ''}
        </div>

        {/* Save view toast */}
        {saveViewToast && (
          <div className="map-save-toast">✓ Default view saved</div>
        )}
      </div>

      {/* ── Always-visible dashboard panel ── */}
      <div className="club-panel">
        <div className="club-panel-inner">

          {/* Pinned: My Club card — collapsible */}
          <div className="cp-my-club-zone">
            <button
              className="cp-my-club-header"
              onClick={() => setMyClubCollapsed(c => !c)}
            >
              {/* Collapsed: show logo/initials + name inline */}
              <div className="cp-my-club-collapsed-row">
                {myClub?.logo_url
                  ? <img src={myClub.logo_url} alt="logo" className="cp-mcc-thumb" />
                  : <div className="cp-mcc-initials">{(myClub?.club_name || 'MC').slice(0,2).toUpperCase()}</div>
                }
                <span className="cp-mcc-name">{myClub?.club_name || 'Your Club'}</span>
              </div>
              <svg
                className={`cp-mcc-chevron ${myClubCollapsed ? '' : 'open'}`}
                width="14" height="14" viewBox="0 0 16 16" fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {!myClubCollapsed && (
              <div className="cp-my-club-expanded">
                <MyClubCard myClub={myClub} onManage={() => navigate('/app/profile')} />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="cp-panel-divider" />

          {/* Dynamic: selected club details */}
          <div className="cp-detail-zone">
            <div className="cp-zone-label">
              {selected ? 'Club Details' : 'Club Details'}
            </div>
            <ClubDetail
              club={selected}
              userId={user?.id}
              onManage={() => navigate('/app/profile')}
              radiusMiles={radiusMiles}
              setRadiusMiles={setRadiusMiles}
              customMiles={customMiles}
              setCustomMiles={setCustomMiles}
              filteredCount={filteredLocations.length}
              setGalleryPhotos={setGalleryPhotos}
            />
          </div>

          {/* Photo gallery modal */}
          {galleryPhotos && (
            <PhotoGallery
              photos={galleryPhotos.photos}
              startIndex={galleryPhotos.start}
              onClose={() => setGalleryPhotos(null)}
            />
          )}

          {/* Demographics panel — research mode */}
          {demoActive && (
            <div className="cp-demo-zone">
              <div className="cp-panel-divider" style={{ margin: '0 -16px 14px' }} />

              {/* Research mode header */}
              <div className="cp-research-header">
                <div className="cp-research-header-icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#4CAF82" strokeWidth="1.5"/>
                    <circle cx="8" cy="8" r="2" fill="#4CAF82"/>
                    <line x1="8" y1="1" x2="8" y2="3.5" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="8" y1="12.5" x2="8" y2="15" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="1" y1="8" x2="3.5" y2="8" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="12.5" y1="8" x2="15" y2="8" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="cp-research-header-text">
                  <div className="cp-research-title">Market Research Mode</div>
                  <div className="cp-research-sub">Click anywhere on the map to analyze</div>
                </div>
                <button className="cp-research-exit" onClick={() => { setDemoActive(false); setDemoLat(null); setDemoLng(null) }}>
                  Exit
                </button>
              </div>

              {/* Instruction card — shown before first click */}
              {demoLat == null && (
                <div className="cp-research-instruction">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0F6E56"/>
                  </svg>
                  <div className="cp-research-instruction-text">
                    Your cursor has changed to a targeting reticle. Click any area on the map to load its market data, demographics, and score.
                  </div>
                </div>
              )}

              <DemographicsPanel
                lat={demoLat}
                lng={demoLng}
                locations={locations}
                enabledFactors={enabledFactors}
                active={demoActive}
              />
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
