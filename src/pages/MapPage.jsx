import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Fix default Leaflet marker icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom green marker for other clubs
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Blue marker for the current user's location
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function formatHours(location) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const lines = []
  days.forEach((d, i) => {
    const open = location[`hours_${d}_open`]
    const close = location[`hours_${d}_close`]
    if (open && close) lines.push(`${labels[i]}: ${open} – ${close}`)
  })
  return lines.join('\n') || 'Hours not listed'
}

export default function MapPage() {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
        load()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const center = locations.length > 0
    ? [locations[0].lat, locations[0].lng]
    : [41.7, -81.3] // Default: NE Ohio

  return (
    <div className="map-page">
      {loading ? (
        <div className="loading">Loading map…</div>
      ) : (
        <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map(loc => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={loc.user_id === user?.id ? blueIcon : greenIcon}
            >
              <Popup>
                <div className="map-popup-content">
                  <div className="name">{loc.business_name || 'Unnamed club'}</div>
                  {loc.address && <div className="line">{loc.address}</div>}
                  {loc.phone && <div className="line">{loc.phone}</div>}
                  {loc.website && (
                    <div className="line">
                      <a href={loc.website.startsWith('http') ? loc.website : `https://${loc.website}`}
                         target="_blank" rel="noreferrer">
                        {loc.website}
                      </a>
                    </div>
                  )}
                  <pre className="line" style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {formatHours(loc)}
                  </pre>
                  <span className={`tag ${loc.user_id === user?.id ? 'tag-mine' : 'tag-live'}`}>
                    {loc.user_id === user?.id ? 'Your location' : 'Live'}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
      <div style={{
        position: 'absolute', bottom: 24, left: 16, zIndex: 500,
        background: '#fff', border: '1px solid #e0e8e0', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, lineHeight: 1.8, pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#185FA5' }}></div>
          <span style={{ color: '#555' }}>Your location</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1D9E75' }}></div>
          <span style={{ color: '#555' }}>Other clubs</span>
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 500,
        background: '#fff', border: '1px solid #e0e8e0', borderRadius: 10,
        padding: '8px 14px', fontSize: 13, pointerEvents: 'none'
      }}>
        <strong style={{ color: '#1D9E75' }}>{locations.length}</strong> club{locations.length !== 1 ? 's' : ''} registered
      </div>
    </div>
  )
}
