import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import DemographicsPanel from '../components/DemographicsPanel'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const makeIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const greenIcon = makeIcon('green')
const blueIcon  = makeIcon('blue')
const goldIcon  = makeIcon('gold')

const BASE_MAPS = [
  { id: 'carto',     label: 'Clean',    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  { id: 'street',    label: 'Street',   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  { id: 'satellite', label: 'Aerial',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  { id: 'topo',      label: 'Topo',     url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap' },
]

const RADIUS_PRESETS = [1, 2, 5, 10]
const PANEL_POSITIONS = ['right', 'left', 'bottom']

function milesToMeters(m) { return m * 1609.34 }

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

function ClubMarkers({ locations, selectedId, userId, onSelect }) {
  const map = useMap()
  const markersRef = useRef({})

  useEffect(() => {
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    locations.forEach(loc => {
      const isOwn      = loc.user_id === userId
      const isSelected = loc.id === selectedId
      const icon = isSelected ? goldIcon : (isOwn ? blueIcon : greenIcon)

      const ownerName = [loc.first_name, loc.last_name].filter(Boolean).join(' ')
      const line1 = loc.business_name || 'Unnamed Club'
      const line2 = ownerName
      const line3 = loc.address ? loc.address + (loc.city ? ', ' + loc.city : '') : (loc.city || '')
      const tooltipHtml = `<div class="ct-name">${line1}</div>${line2 ? `<div class="ct-line">${line2}</div>` : ''}${line3 ? `<div class="ct-line">${line3}</div>` : ''}`

      const tooltip = L.tooltip({ permanent: false, direction: 'top', offset: [0, -36], className: 'club-tooltip' }).setContent(tooltipHtml)

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map).bindTooltip(tooltip).on('click', () => onSelect(loc))

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
        : <div className="mcc-initials">{(myClub.business_name || 'MC').slice(0,2).toUpperCase()}</div>
      }
      <div className="mcc-info">
        <div className="mcc-name">{myClub.business_name || 'Your Club'}</div>
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
function ClubDetail({ club, userId, onManage, radiusMiles, setRadiusMiles, customMiles, setCustomMiles, filteredCount }) {
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

  return (
    <>
      {/* Club header */}
      <div className="cp-header">
        <div className="cp-header-left">
          {club.logo_url
            ? <img src={club.logo_url} alt="logo" className="cp-logo" />
            : <div className="cp-initials">{(club.business_name || 'CL').slice(0,2).toUpperCase()}</div>
          }
          <div>
            <h2 className="cp-name">{club.business_name || 'Unnamed Club'}</h2>
            {club.city && <p className="cp-location">{club.city}{club.state ? `, ${club.state}` : ''}</p>}
            {club.opened_month && club.opened_year && (
              <p className="cp-since">Since {club.opened_month} {club.opened_year}</p>
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
            <small>{club.business_name || 'Your Club'}</small>
          </span>
        </button>
      )}

      {/* Owners */}
      {(ownerName || owner2Name || owner3Name) && (
        <div className="cp-section">
          <div className="cp-section-title">Owners</div>
          {ownerName && <div className="cp-row"><span className="cp-icon">👤</span><span>{ownerName}</span></div>}
          {owner2Name && <div className="cp-row"><span className="cp-icon">👤</span><span>{owner2Name}</span></div>}
          {owner3Name && <div className="cp-row"><span className="cp-icon">👤</span><span>{owner3Name}</span></div>}
        </div>
      )}

      {/* Contact */}
      <div className="cp-section">
        <div className="cp-section-title">Contact</div>
        {club.address && <div className="cp-row"><span className="cp-icon">📍</span><span>{club.address}{club.city ? `, ${club.city}` : ''}</span></div>}
        {club.club_phone && <div className="cp-row"><span className="cp-icon">📞</span><a href={`tel:${club.club_phone}`}>{club.club_phone}</a></div>}
        {club.club_email && <div className="cp-row"><span className="cp-icon">✉️</span><a href={`mailto:${club.club_email}`}>{club.club_email}</a></div>}
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
  const [baseMap, setBaseMap]       = useState('carto')
  const [mapCenter, setMapCenter]   = useState(null)
  const [mapZoom, setMapZoom]       = useState(null)
  const [citySearch, setCitySearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [geocoding, setGeocoding]   = useState(false)
  const [radiusMiles, setRadiusMiles] = useState(null)
  const [customMiles, setCustomMiles] = useState('')

  // Demographics
  const [demoActive, setDemoActive]   = useState(false)
  const [demoLat, setDemoLat]         = useState(null)
  const [demoLng, setDemoLng]         = useState(null)
  const defaultEnabledFactors = { population: true, income: true, ageFit: true, poverty: true, competition: true }
  const [enabledFactors] = useState(defaultEnabledFactors)

  // Panel position — per user, stored in localStorage, default 'right'
  const posKey = user ? `panel_position_${user.id}` : 'panel_position'
  const [panelPosition, setPanelPosition] = useState(() => {
    return localStorage.getItem(posKey) || 'right'
  })

  function updatePanelPosition(pos) {
    setPanelPosition(pos)
    localStorage.setItem(posKey, pos)
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

  function handleSelectClub(loc) {
    setSelected(loc)
    setRadiusMiles(null)
    setCustomMiles('')
    setMapCenter([loc.lat, loc.lng])
    setMapZoom(14)
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
      <div className="map-area">
        {loading ? <div className="loading">Loading map…</div> : (
          <MapContainer center={defaultCenter} zoom={locations.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
            <MapController center={mapCenter} zoom={mapZoom} panelPosition={panelPosition} />
            <MapClickHandler active={demoActive} onMapClick={(lat, lng) => { setDemoLat(lat); setDemoLng(lng) }} />
            <TileLayer key={activeBase.id} attribution={activeBase.attribution} url={activeBase.url} />
            <ClubMarkers locations={filteredLocations} selectedId={selected?.id} userId={user?.id} onSelect={handleSelectClub} />
            {selected && radiusMiles && (
              <Circle center={[selected.lat, selected.lng]} radius={milesToMeters(radiusMiles)}
                pathOptions={{ color: '#1A3C2E', fillColor: '#4CAF82', fillOpacity: 0.08, weight: 2 }} />
            )}
          </MapContainer>
        )}

        {/* Search toolbar */}
        <div className="map-toolbar">
          <form className="map-search-form" onSubmit={handleCitySearch}>
            <input className="map-search-input" type="text" placeholder="Filter by city, state…"
              value={citySearch} onChange={e => setCitySearch(e.target.value)} />
            <button className="map-search-btn" type="submit" disabled={geocoding}>{geocoding ? '…' : '⌕'}</button>
          </form>
          {hasFilter && <button className="map-clear-btn" onClick={clearFilters}>✕ Clear</button>}
          <button
            className={`map-demo-btn ${demoActive ? 'active' : ''}`}
            onClick={() => { setDemoActive(d => !d); if (!demoActive) { setDemoLat(null); setDemoLng(null) } }}
            title="Toggle market data">
            📊 Market Data
          </button>
        </div>

        {/* Base map + panel position toggles */}
        <div className="map-controls-bottom">
          <div className="map-basemap-toggle">
            {BASE_MAPS.map(b => (
              <button key={b.id} className={`basemap-btn ${baseMap === b.id ? 'active' : ''}`} onClick={() => setBaseMap(b.id)}>{b.label}</button>
            ))}
          </div>
          <div className="map-position-toggle" title="Panel position">
            {[
              { pos: 'left',   icon: '⬅' },
              { pos: 'bottom', icon: '⬇' },
              { pos: 'right',  icon: '➡' },
            ].map(({ pos, icon }) => (
              <button key={pos} className={`position-btn ${panelPosition === pos ? 'active' : ''}`}
                onClick={() => updatePanelPosition(pos)} title={`Panel on ${pos}`}>{icon}</button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="map-legend">
          <div className="legend-row"><div className="legend-dot blue" /><span>Your club</span></div>
          <div className="legend-row"><div className="legend-dot green" /><span>Other clubs</span></div>
          <div className="legend-row"><div className="legend-dot gold" /><span>Selected</span></div>
        </div>

        {/* Club count */}
        <div className="map-count">
          <strong>{filteredLocations.length}</strong>
          {hasFilter ? ` of ${locations.length}` : ''} club{filteredLocations.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Always-visible dashboard panel ── */}
      <div className="club-panel">
        <div className="club-panel-inner">

          {/* Pinned: My Club card — always at top */}
          <div className="cp-my-club-zone">
            <div className="cp-zone-label">My Club</div>
            <MyClubCard myClub={myClub} onManage={() => navigate('/profile')} />
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
              onManage={() => navigate('/profile')}
              radiusMiles={radiusMiles}
              setRadiusMiles={setRadiusMiles}
              customMiles={customMiles}
              setCustomMiles={setCustomMiles}
              filteredCount={filteredLocations.length}
            />
          </div>

          {/* Demographics panel */}
          {demoActive && (
            <div className="cp-demo-zone">
              <div className="cp-panel-divider" style={{ margin: '0 -16px 14px' }} />
              <div className="cp-zone-label">Market Data</div>
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
