import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'

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
const goldIcon  = makeIcon('gold')   // selected

const BASE_MAPS = [
  { id: 'carto',     label: 'Clean',    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  { id: 'street',    label: 'Street',   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap' },
  { id: 'satellite', label: 'Aerial',   url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
  { id: 'topo',      label: 'Topo',     url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap' },
]

const RADIUS_PRESETS = [1, 2, 5, 10]

function milesToMeters(m) { return m * 1609.34 }

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatHours(loc) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const rows = []
  days.forEach((d, i) => {
    const o = loc[`hours_${d}_open`], c = loc[`hours_${d}_close`]
    if (o && c) rows.push({ day: labels[i], hours: `${o} – ${c}` })
  })
  return rows
}

function MapController({ center, zoom, panelOpen }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      setTimeout(() => {
        map.invalidateSize()
        map.setView(center, zoom || map.getZoom(), { animate: true })
      }, 320)
    }
  }, [center, zoom])

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 320)
  }, [panelOpen])

  return null
}

// Renders markers without Leaflet Popups — click handled manually
function ClubMarkers({ locations, selectedId, userId, onSelect }) {
  const map = useMap()
  const markersRef = useRef({})

  useEffect(() => {
    // Remove old markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    locations.forEach(loc => {
      const isOwn     = loc.user_id === userId
      const isSelected = loc.id === selectedId
      const icon = isSelected ? goldIcon : (isOwn ? blueIcon : greenIcon)

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .on('click', () => onSelect(loc))

      markersRef.current[loc.id] = marker
    })

    return () => {
      Object.values(markersRef.current).forEach(m => m.remove())
      markersRef.current = {}
    }
  }, [locations, selectedId, userId])

  return null
}

export default function MapPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [baseMap, setBaseMap]         = useState('carto')
  const [mapCenter, setMapCenter]     = useState(null)
  const [mapZoom, setMapZoom]         = useState(null)

  // City filter
  const [citySearch, setCitySearch]   = useState('')
  const [cityFilter, setCityFilter]   = useState('')
  const [geocoding, setGeocoding]     = useState(false)

  // Radius
  const [radiusMiles, setRadiusMiles] = useState(null)
  const [customMiles, setCustomMiles] = useState('')

  const panelOpen = !!selected

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations').select('*').not('lat', 'is', null).not('lng', 'is', null)
      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()
    const channel = supabase.channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  function handleSelectClub(loc) {
    setSelected(loc)
    setRadiusMiles(null)
    setCustomMiles('')
    setMapCenter([loc.lat, loc.lng])
    setMapZoom(14)
  }

  function closePanel() {
    setSelected(null)
    setRadiusMiles(null)
    setCustomMiles('')
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
      const hay = `${loc.city||''} ${loc.state_zip||''} ${loc.address||''}`.toLowerCase()
      return hay.includes(cityFilter.toLowerCase())
    }
    return true
  })

  const activeBase = BASE_MAPS.find(b => b.id === baseMap) || BASE_MAPS[0]
  const defaultCenter = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [39.5, -98.35]
  const hasFilter = cityFilter || radiusMiles
  const isOwnClub = selected && selected.user_id === user?.id
  const hourRows = selected ? formatHours(selected) : []

  return (
    <div className={`map-wrapper ${panelOpen ? 'panel-open' : ''}`}>

      {/* ── Map area ── */}
      <div className="map-area">
        {loading ? (
          <div className="loading">Loading map…</div>
        ) : (
          <MapContainer center={defaultCenter} zoom={locations.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
            <MapController center={mapCenter} zoom={mapZoom} panelOpen={panelOpen} />
            <TileLayer key={activeBase.id} attribution={activeBase.attribution} url={activeBase.url} />
            <ClubMarkers
              locations={filteredLocations}
              selectedId={selected?.id}
              userId={user?.id}
              onSelect={handleSelectClub}
            />
            {selected && radiusMiles && (
              <Circle
                center={[selected.lat, selected.lng]}
                radius={milesToMeters(radiusMiles)}
                pathOptions={{ color: '#1A3C2E', fillColor: '#4CAF82', fillOpacity: 0.08, weight: 2 }}
              />
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
        </div>

        {/* Base map toggle */}
        <div className="map-basemap-toggle">
          {BASE_MAPS.map(b => (
            <button key={b.id} className={`basemap-btn ${baseMap === b.id ? 'active' : ''}`} onClick={() => setBaseMap(b.id)}>
              {b.label}
            </button>
          ))}
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

      {/* ── Detail panel ── */}
      {panelOpen && (
        <div className="club-panel">
          <div className="club-panel-inner">

            {/* Header */}
            <div className="cp-header">
              <div className="cp-header-text">
                <h2 className="cp-name">{selected.business_name || 'Unnamed Club'}</h2>
                {selected.city && (
                  <p className="cp-location">{selected.city}{selected.state_zip ? `, ${selected.state_zip}` : ''}</p>
                )}
              </div>
              <button className="cp-close" onClick={closePanel} aria-label="Close">✕</button>
            </div>

            {/* Own club CTA */}
            {isOwnClub && (
              <button className="cp-manage-btn" onClick={() => navigate('/profile')}>
                <span>✏️</span>
                <span>
                  <strong>Manage My Club</strong>
                  <small>{selected.business_name || 'Your Club'}</small>
                </span>
              </button>
            )}

            {/* Contact info */}
            <div className="cp-section">
              <div className="cp-section-title">Contact</div>
              {selected.address && (
                <div className="cp-row">
                  <span className="cp-icon">📍</span>
                  <span>{selected.address}{selected.city ? `, ${selected.city}` : ''}</span>
                </div>
              )}
              {selected.phone && (
                <div className="cp-row">
                  <span className="cp-icon">📞</span>
                  <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                </div>
              )}
              {selected.website && (
                <div className="cp-row">
                  <span className="cp-icon">🌐</span>
                  <a href={selected.website.startsWith('http') ? selected.website : `https://${selected.website}`}
                     target="_blank" rel="noreferrer">{selected.website}</a>
                </div>
              )}
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

            {/* Social links */}
            {(selected.social_facebook || selected.social_instagram || selected.social_tiktok || selected.social_youtube) && (
              <div className="cp-section">
                <div className="cp-section-title">Social</div>
                <div className="cp-socials">
                  {selected.social_facebook && (
                    <a href={selected.social_facebook} target="_blank" rel="noreferrer" className="cp-social-link">Facebook</a>
                  )}
                  {selected.social_instagram && (
                    <a href={selected.social_instagram} target="_blank" rel="noreferrer" className="cp-social-link">Instagram</a>
                  )}
                  {selected.social_tiktok && (
                    <a href={selected.social_tiktok} target="_blank" rel="noreferrer" className="cp-social-link">TikTok</a>
                  )}
                  {selected.social_youtube && (
                    <a href={selected.social_youtube} target="_blank" rel="noreferrer" className="cp-social-link">YouTube</a>
                  )}
                </div>
              </div>
            )}

            {/* Radius search */}
            <div className="cp-section cp-radius-section">
              <div className="cp-section-title">Search Nearby Clubs</div>
              <p className="cp-radius-hint">Show clubs within a radius of this location</p>
              <div className="radius-presets">
                {RADIUS_PRESETS.map(m => (
                  <button key={m}
                    className={`radius-preset-btn ${radiusMiles === m ? 'active' : ''}`}
                    onClick={() => setRadiusMiles(radiusMiles === m ? null : m)}
                  >
                    {m} mi
                  </button>
                ))}
              </div>
              <div className="radius-custom">
                <input type="number" min="0.5" max="50" step="0.5"
                  placeholder="Custom miles"
                  value={customMiles}
                  onChange={e => setCustomMiles(e.target.value)}
                />
                <button className="radius-preset-btn"
                  onClick={() => { if (customMiles) setRadiusMiles(parseFloat(customMiles)) }}
                  disabled={!customMiles}>
                  Apply
                </button>
              </div>
              {radiusMiles && (
                <div className="radius-result">
                  {filteredLocations.length} club{filteredLocations.length !== 1 ? 's' : ''} within {radiusMiles} mi
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
