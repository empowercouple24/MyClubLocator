import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2,'0')} ${period}`
}

function formatHoursSummary(loc) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const open = days.filter(d => loc[`hours_${d}_open`] && loc[`hours_${d}_close`])
  if (open.length === 0) return null
  const first = labels[days.indexOf(open[0])]
  const last  = labels[days.indexOf(open[open.length - 1])]
  const o = formatTime(loc[`hours_${open[0]}_open`])
  const c = formatTime(loc[`hours_${open[0]}_close`])
  if (open.length === 7) return `Daily · ${o} – ${c}`
  if (open.length === 1) return `${first} · ${o} – ${c}`
  return `${first}–${last} · ${o} – ${c}`
}

function getDaysOpen(loc) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['M','T','W','Th','F','Sa','Su']
  return days.map((d, i) => ({
    label: labels[i],
    open: !!(loc[`hours_${d}_open`] && loc[`hours_${d}_close`])
  }))
}

export default function DirectoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [sortBy, setSortBy]       = useState('name')

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

  const filtered = locations
    .filter(loc => {
      const q = search.toLowerCase()
      return !q ||
        loc.business_name?.toLowerCase().includes(q) ||
        loc.city?.toLowerCase().includes(q) ||
        loc.state?.toLowerCase().includes(q) ||
        [loc.first_name, loc.last_name].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'name')  return (a.business_name || '').localeCompare(b.business_name || '')
      if (sortBy === 'city')  return (a.city || '').localeCompare(b.city || '')
      if (sortBy === 'newer') return (b.opened_year || '0').localeCompare(a.opened_year || '0')
      if (sortBy === 'older') return (a.opened_year || '9999').localeCompare(b.opened_year || '9999')
      return 0
    })

  return (
    <div className="dir-page">
      <div className="page-header">
        <div>
          <div className="page-title">Club Directory</div>
          <div className="page-sub">{locations.length} club{locations.length !== 1 ? 's' : ''} registered</div>
        </div>
        <div className="dir-controls">
          <input className="search-input" type="text"
            placeholder="Search name, city, owner…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="dir-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Name A–Z</option>
            <option value="city">City A–Z</option>
            <option value="newer">Newest first</option>
            <option value="older">Oldest first</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading directory…</div>
      ) : filtered.length === 0 ? (
        <div className="loading" style={{ height: 120 }}>No clubs found{search ? ` for "${search}"` : ''}.</div>
      ) : (
        <div className="dir-grid">
          {filtered.map(loc => {
            const isYours     = loc.user_id === user?.id
            const ownerName   = [loc.first_name, loc.last_name].filter(Boolean).join(' ')
            const owner2Name  = [loc.owner2_first_name, loc.owner2_last_name].filter(Boolean).join(' ')
            const hoursSummary = formatHoursSummary(loc)
            const dayDots     = getDaysOpen(loc)
            const hasDays     = dayDots.some(d => d.open)

            return (
              <div className={`dir-card ${isYours ? 'dir-card-mine' : ''}`} key={loc.id}
                onClick={() => isYours ? navigate('/profile') : null}
                style={{ cursor: isYours ? 'pointer' : 'default' }}>

                {/* Card top: logo + name + badge */}
                <div className="dc-header">
                  {loc.logo_url
                    ? <img src={loc.logo_url} alt="logo" className="dc-logo" />
                    : <div className="dc-initials">{(loc.business_name || 'CL').slice(0,2).toUpperCase()}</div>
                  }
                  <div className="dc-header-text">
                    <div className="dc-name-row">
                      <span className="dc-name">{loc.business_name || 'Unnamed Club'}</span>
                      {isYours && <span className="badge-yours">Yours</span>}
                    </div>
                    {loc.city && (
                      <div className="dc-city">{loc.city}{loc.state ? `, ${loc.state}` : ''}</div>
                    )}
                  </div>
                </div>

                {/* Owners */}
                {ownerName && (
                  <div className="dc-owners">
                    <span className="dc-owner-name">{ownerName}</span>
                    {owner2Name && <span className="dc-owner-sep">·</span>}
                    {owner2Name && <span className="dc-owner-name">{owner2Name}</span>}
                  </div>
                )}

                {/* Address */}
                {loc.address && (
                  <div className="dc-addr">{loc.address}</div>
                )}

                {/* Contact row */}
                <div className="dc-contact-row">
                  {loc.club_email && (
                    <a href={`mailto:${loc.club_email}`} className="dc-contact-link" onClick={e => e.stopPropagation()}>
                      ✉ {loc.club_email}
                    </a>
                  )}
                  {loc.club_phone && (
                    <a href={`tel:${loc.club_phone}`} className="dc-contact-link" onClick={e => e.stopPropagation()}>
                      ✆ {loc.club_phone}
                    </a>
                  )}
                </div>

                {/* Hours */}
                {hoursSummary && (
                  <div className="dc-hours-row">
                    <span className="dc-hours-summary">🕐 {hoursSummary}</span>
                  </div>
                )}

                {/* Day dots */}
                {hasDays && (
                  <div className="dc-day-dots">
                    {dayDots.map(d => (
                      <span key={d.label} className={`dc-day-dot ${d.open ? 'open' : 'closed'}`} title={d.open ? 'Open' : 'Closed'}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: opened + social */}
                <div className="dc-footer">
                  {loc.opened_month && loc.opened_year && (
                    <span className="dc-since">Since {loc.opened_month} {loc.opened_year}</span>
                  )}
                  <div className="dc-social-icons">
                    {loc.social_instagram && <a href={loc.social_instagram} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">IG</a>}
                    {loc.social_facebook  && <a href={loc.social_facebook}  target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">FB</a>}
                    {loc.social_tiktok    && <a href={loc.social_tiktok}    target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">TK</a>}
                    {loc.social_youtube   && <a href={loc.social_youtube}   target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">YT</a>}
                  </div>
                </div>

                {/* Your club edit prompt */}
                {isYours && (
                  <div className="dc-edit-prompt">Tap to edit your profile →</div>
                )}

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
