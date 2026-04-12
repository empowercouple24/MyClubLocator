import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function formatPhone(raw) {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return raw
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2,'0')} ${period}`
}

function getDaysOpen(loc) {
  const days   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['M','T','W','Th','F','Sa','Su']
  return days.map((d, i) => ({
    label: labels[i],
    day: d,
    dayFull: d.slice(0,3).replace(/^\w/, c => c.toUpperCase()),
    open: !!(loc[`hours_${d}_open`] && loc[`hours_${d}_close`]),
    openTime:  loc[`hours_${d}_open`]  || '',
    closeTime: loc[`hours_${d}_close`] || '',
  }))
}

const DAY_NAMES_FULL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function condenseHours(dayDots) {
  // Only consider days that are open
  const open = dayDots.filter(d => d.open)
  if (open.length === 0) return []

  // Group consecutive days with identical hours into ranges
  const ranges = []
  let run = [open[0]]

  for (let i = 1; i < open.length; i++) {
    const prev = run[run.length - 1]
    const curr = open[i]
    // Check consecutive in week AND same hours
    const prevIdx = dayDots.indexOf(prev)
    const currIdx = dayDots.indexOf(curr)
    const consecutive = currIdx === prevIdx + 1
    const sameHours = prev.openTime === curr.openTime && prev.closeTime === curr.closeTime
    if (consecutive && sameHours) {
      run.push(curr)
    } else {
      ranges.push(run)
      run = [curr]
    }
  }
  ranges.push(run)

  return ranges.map(run => {
    const first = run[0]
    const last  = run[run.length - 1]
    const label = run.length === 1
      ? first.dayFull
      : `${first.dayFull}–${last.dayFull}`
    return {
      label,
      time: `${formatTime(first.openTime)} – ${formatTime(first.closeTime)}`
    }
  })
}

function condenseLevelLabel(level) {
  if (!level) return ''
  return level
    .replace('Presidents Team', 'PT')
    .replace('Chairmans Club', 'CC')
    .replace('Founders Circle', 'FC')
    .replace('Millionaire Team 7500', 'MP')
    .replace('Millionaire Team', 'MT')
    .replace('Get Team 2500', 'GP')
    .replace('Get Team', 'GT')
    .replace('Active World Team', 'AWT')
    .replace('World Team', 'WT')
    .replace('Supervisor', 'SP')
    .replace('Success Builder', 'SB')
    .replace('Distributor', 'DS')
}

function LevelPill({ level }) {
  if (!level) return null
  let bg = '#eef2f7', color = '#555', border = 'transparent'
  if (/^Presidents Team/.test(level))  { bg = '#fdf6cc'; color = '#7a5200'; border = '#c9a800' }
  else if (/^Chairmans Club/.test(level)) { bg = '#f0f0f4'; color = '#3a3a50'; border = '#b0b0c8' }
  else if (/^Founders Circle/.test(level)) { bg = '#f8f8ff'; color = '#3a3060'; border = '#c8c0e8' }
  else if (/^(Supervisor|World Team|Active World Team|Distributor|Success Builder)/.test(level)) { bg = '#f0f0f0'; color = '#555'; border = '#ccc' }
  else if (/^(Get Team|Millionaire)/.test(level)) { bg = '#e8f8f0'; color = '#0c5a32'; border = '#A8DFC4' }

  const condensed = condenseLevelLabel(level)
  const display = condensed.includes(' 💎')
    ? <>{condensed.replace(/ (\d+) 💎$/, (_, d) => ` ${d} `)}<span style={{ fontSize: 10 }}>💎</span></>
    : condensed

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 20, background: bg, color, border: `0.5px solid ${border}`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {display}
    </span>
  )
}

function DirCard({ loc, isYours, defaultExpanded, navigate }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const ownerName  = [loc.first_name,  loc.last_name ].filter(Boolean).join(' ')
  const owner2Name = [loc.owner2_first_name, loc.owner2_last_name].filter(Boolean).join(' ')
  const owner3Name = [loc.owner3_first_name, loc.owner3_last_name].filter(Boolean).join(' ')
  const dayDots    = getDaysOpen(loc)
  const hasDays    = dayDots.some(d => d.open)
  const condensed  = condenseHours(dayDots)

  // Address formatted: street, city, state
  const addressLine = [loc.address, loc.city, loc.state].filter(Boolean).join(', ')

  return (
    <div className={`dir-card ${isYours ? 'dir-card-mine' : ''} ${expanded ? 'expanded' : ''}`}>

      {/* ── Collapsed header — always visible ── */}
      <button className="dc-toggle-row" onClick={() => setExpanded(e => !e)}>
        <div className="dc-toggle-left">
          {loc.logo_url
            ? <img src={loc.logo_url} alt="logo" className="dc-logo-sm" />
            : <div className="dc-initials-sm">{(loc.club_name || 'CL').slice(0,2).toUpperCase()}</div>
          }
          <div className="dc-toggle-info">
            <div className="dc-name-row">
              <span className="dc-name">{loc.club_name || 'Unnamed Club'}</span>
              {isYours && <span className="badge-yours">Yours</span>}
            </div>
            {addressLine && (
              <div className="dc-city-line">{addressLine}</div>
            )}
          </div>
        </div>
        <svg className={`dc-chevron ${expanded ? 'open' : ''}`}
          width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="dc-expanded">

          {/* Owners */}
          {ownerName && (
            <div className="dc-owners-block">
              {/* Owner 1 */}
              <div className="dc-owner-row">
                {loc.owner_photo_url && (
                  <img src={loc.owner_photo_url} alt={ownerName} className="dc-owner-photo" />
                )}
                <div className="dc-owner-details">
                  <span className="dc-owner-title">Primary Owner</span>
                  <span className="dc-owner-name">{ownerName}</span>
                </div>
                <LevelPill level={loc.herbalife_level} />
              </div>
              {/* Owner 2 */}
              {owner2Name && (
                <div className="dc-owner-row" style={{ marginTop: 6 }}>
                  {loc.owner2_photo_url && (
                    <img src={loc.owner2_photo_url} alt={owner2Name} className="dc-owner-photo" />
                  )}
                  <div className="dc-owner-details">
                    <span className="dc-owner-title">Co-Owner</span>
                    <span className="dc-owner-name">{owner2Name}</span>
                  </div>
                </div>
              )}
              {/* Owner 3 */}
              {owner3Name && (
                <div className="dc-owner-row" style={{ marginTop: 6 }}>
                  {loc.owner3_photo_url && (
                    <img src={loc.owner3_photo_url} alt={owner3Name} className="dc-owner-photo" />
                  )}
                  <div className="dc-owner-details">
                    <span className="dc-owner-title">Co-Owner</span>
                    <span className="dc-owner-name">{owner3Name}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contact — not clickable */}
          <div className="dc-contact-block">
            {loc.club_phone && (
              <div className="dc-contact-item">
                <span className="dc-contact-icon">✆</span>
                <span className="dc-contact-val">{formatPhone(loc.club_phone)}</span>
              </div>
            )}
            {loc.club_email && (
              <div className="dc-contact-item">
                <span className="dc-contact-icon">✉</span>
                <span className="dc-contact-val">{loc.club_email}</span>
              </div>
            )}
            {loc.website && (
              <div className="dc-contact-item">
                <span className="dc-contact-icon">🌐</span>
                <a href={loc.website.startsWith('http') ? loc.website : `https://${loc.website}`}
                  target="_blank" rel="noreferrer" className="dc-link"
                  onClick={e => e.stopPropagation()}>
                  {loc.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {loc.social_instagram && (
              <div className="dc-contact-item">
                <span className="dc-contact-icon">IG</span>
                <a href={loc.social_instagram.startsWith('http') ? loc.social_instagram : `https://instagram.com/${loc.social_instagram.replace(/^@/,'')}`}
                  target="_blank" rel="noreferrer" className="dc-link"
                  onClick={e => e.stopPropagation()}>
                  {loc.social_instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//,'')}
                </a>
              </div>
            )}
          </div>

          {/* Hours — condensed */}
          {condensed.length > 0 && (
            <div className="dc-hours-block">
              {condensed.map((r, i) => (
                <div key={i} className="dc-hours-row-full">
                  <span className="dc-hours-day">{r.label}</span>
                  <span className="dc-hours-time">{r.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* Day dots */}
          {hasDays && (
            <div className="dc-day-dots">
              {dayDots.map(d => (
                <span key={d.label} className={`dc-day-dot ${d.open ? 'open' : 'closed'}`}>{d.label}</span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="dc-footer">
            {loc.opened_month && loc.opened_year && (
              <span className="dc-since">Since {loc.opened_month} {loc.opened_year}</span>
            )}
            <div className="dc-social-icons">
              {loc.social_facebook  && <a href={loc.social_facebook}  target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">FB</a>}
              {loc.social_tiktok    && <a href={loc.social_tiktok}    target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">TK</a>}
              {loc.social_youtube   && <a href={loc.social_youtube}   target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="dc-social-ico">YT</a>}
            </div>
          </div>

          {isYours && (
            <button className="dc-edit-prompt" onClick={() => navigate('/app/profile')}>
              Edit my profile →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function DirectoryPage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const [locations, setLocations] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState(searchParams.get('search') || '')
  const [sortBy, setSortBy]       = useState('name')
  const [filterState, setFilterState] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [hasSearched, setHasSearched] = useState(!!(searchParams.get('search')))

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('club_name', { ascending: true })
      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()
  }, [])

  const states = useMemo(() =>
    [...new Set(locations.map(l => l.state).filter(Boolean))].sort()
  , [locations])

  const levels = useMemo(() => {
    const raw = [...new Set(locations.map(l => l.herbalife_level).filter(Boolean))]
    return raw.sort()
  }, [locations])

  const isFiltered = search || filterState || filterLevel

  const filtered = useMemo(() => {
    if (!isFiltered) return []
    return locations
      .filter(loc => {
        const q = search.toLowerCase()
        const matchQ = !q ||
          loc.club_name?.toLowerCase().includes(q) ||
          loc.city?.toLowerCase().includes(q) ||
          loc.state?.toLowerCase().includes(q) ||
          [loc.first_name, loc.last_name].filter(Boolean).join(' ').toLowerCase().includes(q) ||
          [loc.owner2_first_name, loc.owner2_last_name].filter(Boolean).join(' ').toLowerCase().includes(q)
        const matchState = !filterState || loc.state === filterState
        const matchLevel = !filterLevel || (loc.herbalife_level || '') === filterLevel
        return matchQ && matchState && matchLevel
      })
      .sort((a, b) => {
        if (sortBy === 'name')  return (a.club_name || '').localeCompare(b.club_name || '')
        if (sortBy === 'city')  return (a.city || '').localeCompare(b.city || '')
        if (sortBy === 'newer') return (b.opened_year || '0').localeCompare(a.opened_year || '0')
        if (sortBy === 'older') return (a.opened_year || '9999').localeCompare(b.opened_year || '9999')
        return 0
      })
  }, [locations, search, filterState, filterLevel, sortBy])

  function handleSearchChange(val) {
    setSearch(val)
    if (val) setHasSearched(true)
  }

  function clearFilters() {
    setSearch(''); setFilterState(''); setFilterLevel(''); setHasSearched(false)
  }

  return (
    <div className="dir-page">
      <div className="page-header">
        <div>
          <div className="page-title">Club Directory</div>
          <div className="page-sub">{locations.length} club{locations.length !== 1 ? 's' : ''} registered</div>
        </div>
      </div>

      {/* Controls */}
      <div className="dir-controls-bar">
        <input className="search-input" type="text"
          placeholder="Search name, city, owner…"
          value={search} onChange={e => handleSearchChange(e.target.value)} />
        <select className="dir-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Name A–Z</option>
          <option value="city">City A–Z</option>
          <option value="newer">Newest first</option>
          <option value="older">Oldest first</option>
        </select>
        <select className="dir-filter" value={filterState} onChange={e => { setFilterState(e.target.value); setHasSearched(true) }}>
          <option value="">All states</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="dir-filter" value={filterLevel} onChange={e => { setFilterLevel(e.target.value); setHasSearched(true) }}>
          <option value="">All levels</option>
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        {isFiltered && (
          <button className="dir-clear-btn" onClick={clearFilters}>✕ Clear</button>
        )}
      </div>

      {loading ? (
        <div className="loading">Loading directory…</div>
      ) : !isFiltered ? (
        <div className="dir-empty-state">
          <div className="dir-empty-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="14" cy="14" r="9" stroke="#1A3C2E" strokeWidth="1.5"/>
              <path d="M21 21l7 7" stroke="#1A3C2E" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="14" y1="10" x2="14" y2="18" stroke="#1A3C2E" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="14" x2="18" y2="14" stroke="#1A3C2E" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="dir-empty-title">Search or filter to find clubs</div>
          <div className="dir-empty-sub">Use the search bar or filters above to browse the directory.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dir-empty-state">
          <div className="dir-empty-title">No clubs found</div>
          <div className="dir-empty-sub">Try a different search or filter.</div>
          <button className="dir-clear-btn" style={{ marginTop: 12 }} onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <>
          <div className="dir-results-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>
          <div className="dir-grid">
            {filtered.map(loc => (
              <DirCard
                key={loc.id}
                loc={loc}
                isYours={loc.user_id === user?.id}
                defaultExpanded={false}
                navigate={navigate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
