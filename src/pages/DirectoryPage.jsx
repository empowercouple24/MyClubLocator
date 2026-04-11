import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function formatHoursSummary(loc) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const open = days.filter(d => loc[`hours_${d}_open`] && loc[`hours_${d}_close`])
  if (open.length === 0) return null
  if (open.length === 7) {
    const o = loc[`hours_monday_open`]
    const c = loc[`hours_monday_close`]
    return `Daily ${o}–${c}`
  }
  const first = labels[days.indexOf(open[0])]
  const last = labels[days.indexOf(open[open.length - 1])]
  const o = loc[`hours_${open[0]}_open`]
  const c = loc[`hours_${open[0]}_close`]
  return `${first}–${last} ${o}–${c}`
}

export default function DirectoryPage() {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('business_name', { ascending: true })

      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = locations.filter(loc => {
    const q = search.toLowerCase()
    return (
      !q ||
      loc.business_name?.toLowerCase().includes(q) ||
      loc.address?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="dir-page">
      <div className="page-header">
        <div>
          <div className="page-title">All registered clubs</div>
          <div className="page-sub">{locations.length} location{locations.length !== 1 ? 's' : ''} live on the map</div>
        </div>
        <input
          className="search-input"
          type="text"
          placeholder="Search by name or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Loading directory…</div>
      ) : filtered.length === 0 ? (
        <div className="loading" style={{ height: 120 }}>No clubs found{search ? ` for "${search}"` : ''}.</div>
      ) : (
        <div className="dir-grid">
          {filtered.map(loc => {
            const isYours = loc.user_id === user?.id
            const hoursSummary = formatHoursSummary(loc)
            return (
              <div className="dir-card" key={loc.id}>
                <div className="dc-top">
                  <div className="dc-name">{loc.business_name || 'Unnamed club'}</div>
                  {isYours && <span className="badge-yours">Yours</span>}
                </div>
                <div className="dc-addr">
                  {loc.address || <span style={{ color: '#aaa' }}>Address not set</span>}
                </div>
                <div className="dc-chips">
                  {hoursSummary && <span className="chip">{hoursSummary}</span>}
                  {loc.website && <span className="chip">{loc.website}</span>}
                  {loc.phone && <span className="chip">{loc.phone}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
