import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import {
  reverseGeocode, fetchZipData, fetchCountyData,
  fetchHealthData, fetchSpendingData, fetchGrowthData,
  fetchCommuteData, fetchCompetitors,
  calcMarketScore, formatCurrency, formatPct, formatNum,
  DEMO_CATEGORIES, DEFAULT_ENABLED_FACTORS,
} from '../lib/demographics'

const GRADE_COLORS = {
  'A+': '#0F6E56', 'A': '#0F6E56', 'A-': '#1D9E75',
  'B+': '#2E7D32', 'B': '#388E3C', 'B-': '#558B2F',
  'C+': '#F57F17', 'C': '#F9A825', 'C-': '#FF8F00',
  'D+': '#E65100', 'D': '#BF360C', 'D-': '#B71C1C',
  'F':  '#C62828',
}

function SignalTag({ label, type }) {
  return <span className={`demo-tag demo-tag-${type}`}>{label}</span>
}

function DataRow({ label, value, note }) {
  return (
    <div className="demo-data-row">
      <span className="demo-data-label">{label}</span>
      <span className="demo-data-value">{value}</span>
      {note && <span className="demo-data-note">{note}</span>}
    </div>
  )
}

function Section({ title, children, countyNote }) {
  return (
    <div className="demo-section">
      <div className="demo-section-header">
        <span className="demo-section-title">{title}</span>
        {countyNote && <span className="demo-county-note">county-level</span>}
      </div>
      {children}
    </div>
  )
}

// Learn about market data modal
function LearnModal({ onClose }) {
  return (
    <div className="demo-learn-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="demo-learn-modal">
        <div className="demo-learn-header">
          <h3 className="demo-learn-title">About Market Data</h3>
          <button className="demo-learn-close" onClick={onClose}>✕</button>
        </div>
        <div className="demo-learn-body">
          {Object.entries(DEMO_CATEGORIES).map(([key, cat]) => (
            <div key={key} className="demo-learn-item">
              <div className="demo-learn-item-title">{cat.label}</div>
              <div className="demo-learn-item-desc">{cat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// User preferences panel
function PrefsPanel({ userPrefs, adminEnabled, onSave, onReset, onClose }) {
  const [local, setLocal] = useState({ ...userPrefs })

  function toggle(key) {
    if (!adminEnabled[key]) return // can't enable what admin turned off
    setLocal(p => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="demo-prefs-panel">
      <div className="demo-prefs-header">
        <span className="demo-prefs-title">Customize data</span>
        <button className="demo-learn-close" onClick={onClose}>✕</button>
      </div>
      <div className="demo-prefs-list">
        {Object.entries(DEMO_CATEGORIES).map(([key, cat]) => {
          const adminOn  = adminEnabled[key] !== false
          const userOn   = local[key] !== false
          const disabled = !adminOn
          return (
            <div key={key} className={`demo-prefs-row ${disabled ? 'disabled' : ''}`}>
              <div className="demo-prefs-row-info">
                <div className="demo-prefs-row-label">{cat.label}</div>
                {disabled && <div className="demo-prefs-row-hint">Disabled by admin</div>}
              </div>
              <button
                className={`demo-pref-toggle ${userOn && adminOn ? 'on' : 'off'}`}
                onClick={() => toggle(key)}
                disabled={disabled}
              >
                <span className="demo-pref-toggle-thumb" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="demo-prefs-footer">
        <button className="demo-prefs-reset" onClick={onReset}>Reset to default</button>
        <button className="demo-prefs-save" onClick={() => onSave(local)}>Save preferences</button>
      </div>
    </div>
  )
}

export default function DemographicsPanel({ lat, lng, locations, enabledFactors, active, viewMode = 'table', onViewModeChange, onGeoInfo }) {
  const { user } = useAuth()
  const [loading, setLoading]         = useState(false)
  const [geoInfo, setGeoInfo]         = useState(null)
  const [zipData, setZipData]         = useState(null)
  const [countyData, setCountyData]   = useState(null)
  const [healthData, setHealthData]   = useState(null)
  const [spendingData, setSpendingData] = useState(null)
  const [growthData, setGrowthData]   = useState(null)
  const [commuteData, setCommuteData] = useState(null)
  const [competitors, setCompetitors] = useState(null)
  const [marketScore, setMarketScore] = useState(null)
  const [error, setError]             = useState(null)
  const [prompted, setPrompted]       = useState(true)
  const [showLearn, setShowLearn]     = useState(false)
  const [showPrefs, setShowPrefs]     = useState(false)
  const [userPrefs, setUserPrefs]     = useState(null)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Load user preferences from Supabase
  useEffect(() => {
    if (!user) return
    async function loadPrefs() {
      try {
        const { data } = await supabase
          .from('user_demo_preferences')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle()
        setUserPrefs(data?.preferences || { ...DEFAULT_ENABLED_FACTORS })
      } catch {
        setUserPrefs({ ...DEFAULT_ENABLED_FACTORS })
      }
    }
    loadPrefs()
  }, [user])

  // Effective factors = admin settings AND user prefs both enabled
  const effectiveFactors = userPrefs
    ? Object.fromEntries(
        Object.keys(DEFAULT_ENABLED_FACTORS).map(k => [
          k,
          (enabledFactors?.[k] !== false) && (userPrefs[k] !== false)
        ])
      )
    : enabledFactors || DEFAULT_ENABLED_FACTORS

  useEffect(() => {
    if (!active) return
    if (lat == null || lng == null) { setPrompted(true); return }
    setPrompted(false)
    loadData(lat, lng)
  }, [lat, lng, active])

  async function loadData(lat, lng) {
    setLoading(true)
    setError(null)
    setGeoInfo(null)
    setZipData(null); setCountyData(null); setHealthData(null)
    setSpendingData(null); setGrowthData(null); setCommuteData(null)
    setCompetitors(null); setMarketScore(null)

    const geo = await reverseGeocode(lat, lng)
    if (!geo) {
      setError('Could not determine location. Make sure you\'re clicking inside the US, then try again.')
      setLoading(false)
      return
    }
    setGeoInfo(geo)
    onGeoInfo?.(geo)

    // Fetch all data in parallel — show results as they arrive
    const results = await Promise.allSettled([
      geo.zip ? fetchZipData(geo.zip) : Promise.resolve(null),
      geo.stateFips && geo.countyFips ? fetchCountyData(geo.stateFips, geo.countyFips) : Promise.resolve(null),
      geo.stateFips && geo.countyFips ? fetchHealthData(geo.stateFips, geo.countyFips) : Promise.resolve(null),
      geo.stateFips && geo.countyFips ? fetchSpendingData(geo.stateFips, geo.countyFips) : Promise.resolve(null),
      geo.stateFips && geo.countyFips ? fetchGrowthData(geo.stateFips, geo.countyFips) : Promise.resolve(null),
      geo.stateFips && geo.countyFips ? fetchCommuteData(geo.stateFips, geo.countyFips) : Promise.resolve(null),
      fetchCompetitors(lat, lng),
    ])

    const [zip, county, health, spending, growth, commute, comps] = results.map(r =>
      r.status === 'fulfilled' ? r.value : null
    )

    setZipData(zip); setCountyData(county); setHealthData(health)
    setSpendingData(spending); setGrowthData(growth)
    setCommuteData(commute); setCompetitors(comps)

    if (!zip && !county) {
      setError('No Census data found for this area. Try clicking a different nearby location.')
      setLoading(false)
      return
    }

    const nearbyCount = locations.filter(loc => {
      if (!loc.lat || !loc.lng) return false
      const R = 3958.8
      const dLat = (loc.lat - lat) * Math.PI / 180
      const dLng = (loc.lng - lng) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 10
    }).length

    const score = calcMarketScore(zip, county, effectiveFactors, nearbyCount, health, growth, spending)
    setMarketScore(score)
    setLoading(false)
  }

  async function savePrefs(prefs) {
    setSavingPrefs(true)
    try {
      await supabase.from('user_demo_preferences')
        .upsert(
          { user_id: user.id, preferences: prefs, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
    } catch {}
    setUserPrefs(prefs)
    setSavingPrefs(false)
    setShowPrefs(false)
  }

  async function resetPrefs() {
    const defaults = Object.fromEntries(
      Object.keys(DEFAULT_ENABLED_FACTORS).map(k => [k, enabledFactors?.[k] !== false])
    )
    await savePrefs(defaults)
  }

  function getSignalTags() {
    const tags = []
    const income  = zipData?.medianIncome || countyData?.medianIncome
    const age     = countyData?.ageFitPct
    const pop     = zipData?.population || countyData?.totalPop
    const poverty = zipData?.povertyRate || countyData?.povertyRate

    if (income != null) {
      if (income >= 75000)      tags.push({ label: 'Strong income', type: 'good' })
      else if (income >= 50000) tags.push({ label: 'Moderate income', type: 'neutral' })
      else                      tags.push({ label: 'Lower income area', type: 'warn' })
    }
    if (age != null) {
      if (age >= 35)      tags.push({ label: 'Great age fit', type: 'good' })
      else if (age >= 28) tags.push({ label: 'Good age fit', type: 'neutral' })
      else                tags.push({ label: 'Older demographic', type: 'warn' })
    }
    if (pop != null) {
      if (pop >= 30000)      tags.push({ label: 'High density', type: 'good' })
      else if (pop >= 10000) tags.push({ label: 'Medium density', type: 'neutral' })
      else                   tags.push({ label: 'Low density', type: 'warn' })
    }
    if (poverty != null && poverty > 20) tags.push({ label: 'High poverty rate', type: 'warn' })
    if (growthData?.trend) {
      if (growthData.trend === 'growing')   tags.push({ label: 'Growing market', type: 'good' })
      else if (growthData.trend === 'declining') tags.push({ label: 'Declining population', type: 'warn' })
    }
    if (healthData?.obesity != null && healthData.obesity > 35) tags.push({ label: 'High obesity rate', type: 'good' })

    const nearbyCount = locations.filter(loc => {
      if (!loc.lat || !loc.lng || !lat || !lng) return false
      const R = 3958.8
      const dLat = (loc.lat - lat) * Math.PI / 180
      const dLng = (loc.lng - lng) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 10
    }).length

    if (nearbyCount === 0)     tags.push({ label: 'No nearby clubs', type: 'good' })
    else if (nearbyCount <= 2) tags.push({ label: `${nearbyCount} club${nearbyCount > 1 ? 's' : ''} nearby`, type: 'neutral' })
    else                       tags.push({ label: `${nearbyCount} clubs nearby`, type: 'warn' })

    return tags
  }

  if (!active) return null

  if (prompted || (lat == null && lng == null)) {
    return (
      <div className="demo-prompt">
        <div className="demo-prompt-icon">📊</div>
        <div className="demo-prompt-text">Click anywhere on the map to load market data for that area</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="demo-loading">
        <div className="demo-spinner" />
        <div>
          <div>Loading market data…</div>
          {geoInfo && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {geoInfo.zip ? `ZIP ${geoInfo.zip} · ` : ''}{geoInfo.countyName || 'Fetching census data'}
          </div>}
        </div>
      </div>
    )
  }

  if (error) return (
    <div className="demo-error">
      <div>{error}</div>
      <button className="demo-retry-btn" onClick={() => loadData(lat, lng)}>Try again</button>
    </div>
  )
  if (!zipData && !countyData) return <div className="demo-error">No census data found for this area.</div>

  const tags       = getSignalTags()
  const gradeColor = marketScore ? (GRADE_COLORS[marketScore.grade] || '#888') : '#888'

  const nearbyClubs = locations.filter(loc => {
    if (!loc.lat || !loc.lng || !lat || !lng) return false
    const R = 3958.8
    const dLat = (loc.lat - lat) * Math.PI / 180
    const dLng = (loc.lng - lng) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 10
  })

  return (
    <div className="demo-panel">
      {showLearn && <LearnModal onClose={() => setShowLearn(false)} />}
      {showPrefs && (
        <PrefsPanel
          userPrefs={userPrefs || DEFAULT_ENABLED_FACTORS}
          adminEnabled={enabledFactors || DEFAULT_ENABLED_FACTORS}
          onSave={savePrefs}
          onReset={resetPrefs}
          onClose={() => setShowPrefs(false)}
        />
      )}

      {/* Location header + action buttons */}
      {geoInfo && (
        <div className="demo-location-header">
          {geoInfo.countyName && <div className="demo-county-name">{geoInfo.countyName}</div>}
          {geoInfo.zip && <span className="demo-zip">ZIP {geoInfo.zip}</span>}
        </div>
      )}

      <div className="demo-action-row">
        <button className="demo-action-btn" onClick={() => setShowLearn(true)}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="5.5" r="1" fill="currentColor"/><line x1="8" y1="8" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          About data
        </button>
        <button className="demo-action-btn" onClick={() => setShowPrefs(true)}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Customize
        </button>
        {/* View mode toggle */}
        <div className="demo-view-toggle">
          <button
            className={`demo-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('table')}
            title="Table view"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="6" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="11" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
          <button
            className={`demo-view-btn ${viewMode === 'widget' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('widget')}
            title="Widget view"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── WIDGET VIEW ── */}
      {viewMode === 'widget' && (
        <div className="demo-widget-view">
          {/* Grade widget */}
          {marketScore && (
            <div className="demo-wv-grade" style={{ borderColor: gradeColor }}>
              <div className="demo-wv-grade-letter" style={{ color: gradeColor }}>{marketScore.grade}</div>
              <div className="demo-wv-grade-info">
                <div className="demo-wv-grade-label">Market Score</div>
                <div className="demo-wv-grade-score">{marketScore.score}/100</div>
              </div>
              <div className="demo-wv-tags">
                {tags.slice(0, 2).map((t, i) => <SignalTag key={i} label={t.label} type={t.type} />)}
              </div>
            </div>
          )}

          {/* Stat grid */}
          <div className="demo-wv-grid">
            {effectiveFactors.population && (zipData?.population || countyData?.totalPop) && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--pop">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="demo-wv-card-val">{formatNum(zipData?.population || countyData?.totalPop)}</div>
                <div className="demo-wv-card-label">Population</div>
                {geoInfo?.zip && <div className="demo-wv-card-sub">ZIP {geoInfo.zip}</div>}
              </div>
            )}

            {effectiveFactors.income && (zipData?.medianIncome || countyData?.medianIncome) && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--income">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="demo-wv-card-val">{formatCurrency(zipData?.medianIncome || countyData?.medianIncome)}</div>
                <div className="demo-wv-card-label">Median Income</div>
                <div className="demo-wv-card-sub">household</div>
              </div>
            )}

            {effectiveFactors.ageFit && countyData?.ageFitPct != null && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--age">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="demo-wv-card-val">{countyData.ageFitPct.toFixed(0)}%</div>
                <div className="demo-wv-card-label">Ages 18–49</div>
                <div className="demo-wv-card-sub">target demo</div>
              </div>
            )}

            {effectiveFactors.health && healthData?.obesity != null && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--health">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="demo-wv-card-val">{formatPct(healthData.obesity)}</div>
                <div className="demo-wv-card-label">Obesity Rate</div>
                <div className="demo-wv-card-sub">higher = more need</div>
              </div>
            )}

            {effectiveFactors.poverty && (zipData?.povertyRate || countyData?.povertyRate) && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--poverty">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="demo-wv-card-val">{formatPct(zipData?.povertyRate || countyData?.povertyRate)}</div>
                <div className="demo-wv-card-label">Poverty Rate</div>
                <div className="demo-wv-card-sub">lower is better</div>
              </div>
            )}

            {effectiveFactors.competition && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--clubs">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/></svg>
                </div>
                <div className="demo-wv-card-val">{nearbyClubs.length}</div>
                <div className="demo-wv-card-label">Nearby Clubs</div>
                <div className="demo-wv-card-sub">within 10 mi</div>
              </div>
            )}

            {effectiveFactors.growth && growthData && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--growth">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="demo-wv-card-val" style={{ color: growthData.growthPct >= 0 ? '#0F6E56' : '#c0392b' }}>
                  {growthData.growthPct > 0 ? '+' : ''}{growthData.growthPct}%
                </div>
                <div className="demo-wv-card-label">Pop. Growth</div>
                <div className="demo-wv-card-sub">2019–2022</div>
              </div>
            )}

            {effectiveFactors.spending && spendingData?.spendingIndex != null && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--spending">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="demo-wv-card-val">{spendingData.spendingIndex}/100</div>
                <div className="demo-wv-card-label">Spending Index</div>
                <div className="demo-wv-card-sub">consumer power</div>
              </div>
            )}

            {effectiveFactors.competitors && competitors && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--competitors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="demo-wv-card-val">{competitors.count}</div>
                <div className="demo-wv-card-label">Competitors</div>
                <div className="demo-wv-card-sub">within 5 mi</div>
              </div>
            )}

            {effectiveFactors.medianAge && (countyData?.medianAge || zipData?.medianAge) != null && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--age">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="demo-wv-card-val">{countyData?.medianAge || zipData?.medianAge}</div>
                <div className="demo-wv-card-label">Median Age</div>
                <div className="demo-wv-card-sub">years</div>
              </div>
            )}

            {effectiveFactors.commute && commuteData?.longCommutePct != null && (
              <div className="demo-wv-card">
                <div className="demo-wv-card-icon demo-wv-icon--commute">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="1" y="3" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 8h2l3 3v5h-5V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="demo-wv-card-val">{commuteData.longCommutePct}%</div>
                <div className="demo-wv-card-label">Long Commute</div>
                <div className="demo-wv-card-sub">60+ min</div>
              </div>
            )}
          </div>

          <div className="demo-source-note">
            Data: US Census ACS 2022 · CDC PLACES · OpenStreetMap
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === 'table' && (<>

      {/* Market grade */}
      {marketScore && (
        <div className="demo-grade-row">
          <div className="demo-grade-block">
            <div className="demo-grade" style={{ color: gradeColor }}>{marketScore.grade}</div>
            <div className="demo-score">Score: {marketScore.score}/100</div>
          </div>
          <div className="demo-tags">
            {tags.map((t, i) => <SignalTag key={i} label={t.label} type={t.type} />)}
          </div>
        </div>
      )}

      {/* Compact metric widgets */}
      {(zipData || countyData || marketScore) && (
        <div className="demo-widgets">
          {(zipData?.population || countyData?.totalPop) && (
            <div className="demo-widget">
              <div className="demo-widget-val">{formatNum(zipData?.population || countyData?.totalPop)}</div>
              <div className="demo-widget-label">Population</div>
            </div>
          )}
          {(zipData?.medianIncome || countyData?.medianIncome) && (
            <div className="demo-widget">
              <div className="demo-widget-val">{formatCurrency(zipData?.medianIncome || countyData?.medianIncome)}</div>
              <div className="demo-widget-label">Median income</div>
            </div>
          )}
          {countyData?.ageFitPct != null && (
            <div className="demo-widget">
              <div className="demo-widget-val">{countyData.ageFitPct.toFixed(0)}%</div>
              <div className="demo-widget-label">Age 18–49</div>
            </div>
          )}
          {nearbyClubs.length > 0 && (
            <div className="demo-widget">
              <div className="demo-widget-val">{nearbyClubs.length}</div>
              <div className="demo-widget-label">Nearby clubs</div>
            </div>
          )}
        </div>
      )}

      {/* Population */}
      {effectiveFactors.population && (
        <Section title="Population">
          {zipData?.population != null && <DataRow label="ZIP population" value={formatNum(zipData.population)} />}
          {countyData?.totalPop != null && <DataRow label="County population" value={formatNum(countyData.totalPop)} />}
          {zipData?.households != null && <DataRow label="Households" value={formatNum(zipData.households)} />}
          {zipData?.avgHouseholdSize != null && <DataRow label="Avg household size" value={zipData.avgHouseholdSize?.toFixed(1)} />}
        </Section>
      )}

      {/* Income */}
      {effectiveFactors.income && (
        <Section title="Income & Economics">
          {(zipData?.medianIncome || countyData?.medianIncome) && (
            <DataRow label="Median household income" value={formatCurrency(zipData?.medianIncome || countyData?.medianIncome)} />
          )}
          {countyData?.perCapitaIncome != null && <DataRow label="Per capita income" value={formatCurrency(countyData.perCapitaIncome)} />}
          {(zipData?.povertyRate || countyData?.povertyRate) && (
            <DataRow label="Poverty rate" value={formatPct(zipData?.povertyRate || countyData?.povertyRate)} />
          )}
          {zipData?.unemploymentRate != null && <DataRow label="Unemployment rate" value={formatPct(zipData.unemploymentRate)} />}
        </Section>
      )}

      {/* Age */}
      {effectiveFactors.ageFit && (
        <Section title="Age Profile" countyNote>
          {countyData?.ageFitPct != null && (
            <DataRow label="Ages 18–49 (target)" value={formatPct(countyData.ageFitPct)} note="Core nutrition club demographic" />
          )}
        </Section>
      )}

      {/* Median age */}
      {effectiveFactors.medianAge && (
        <Section title="Median Age" countyNote>
          {(countyData?.medianAge || zipData?.medianAge) != null && (
            <DataRow label="Median age" value={`${countyData?.medianAge || zipData?.medianAge} yrs`} />
          )}
        </Section>
      )}

      {/* Health indicators */}
      {effectiveFactors.health && healthData && (
        <Section title="Health Indicators" countyNote>
          {healthData.obesity != null      && <DataRow label="Obesity rate"      value={formatPct(healthData.obesity)}      note="Higher = stronger need" />}
          {healthData.inactivity != null   && <DataRow label="Physical inactivity" value={formatPct(healthData.inactivity)} />}
          {healthData.diabetes != null     && <DataRow label="Diabetes rate"      value={formatPct(healthData.diabetes)}    />}
          {healthData.highBP != null       && <DataRow label="High blood pressure" value={formatPct(healthData.highBP)}     />}
          {healthData.mentalHealth != null && <DataRow label="Poor mental health days" value={`${healthData.mentalHealth?.toFixed(1)} days/mo`} />}
        </Section>
      )}

      {/* Consumer spending */}
      {effectiveFactors.spending && spendingData && (
        <Section title="Consumer Spending" countyNote>
          {spendingData.estimatedHealthSpend != null && <DataRow label="Est. health spending/yr" value={formatCurrency(spendingData.estimatedHealthSpend)} note="per capita estimate" />}
          {spendingData.estimatedFoodSpend != null   && <DataRow label="Est. food spending/yr"   value={formatCurrency(spendingData.estimatedFoodSpend)}   note="household estimate" />}
          {spendingData.spendingIndex != null         && <DataRow label="Spending power index"    value={`${spendingData.spendingIndex}/100`} />}
        </Section>
      )}

      {/* Population growth */}
      {effectiveFactors.growth && growthData && (
        <Section title="Population Growth" countyNote>
          <DataRow label="2019–2022 growth" value={`${growthData.growthPct > 0 ? '+' : ''}${growthData.growthPct}%`}
            note={growthData.trend === 'growing' ? 'Growing market' : growthData.trend === 'declining' ? 'Declining' : 'Stable'} />
          {growthData.pop2022 != null && <DataRow label="2022 population" value={formatNum(growthData.pop2022)} />}
        </Section>
      )}

      {/* Commute */}
      {effectiveFactors.commute && commuteData && (
        <Section title="Commute & Walkability" countyNote>
          {commuteData.walkedPct != null   && <DataRow label="Walk to work"       value={`${commuteData.walkedPct}%`} />}
          {commuteData.transitPct != null  && <DataRow label="Public transit"     value={`${commuteData.transitPct}%`} />}
          {commuteData.drovePct != null    && <DataRow label="Drive alone"        value={`${commuteData.drovePct}%`} />}
          {commuteData.longCommutePct != null && <DataRow label="Long commute (60+ min)" value={`${commuteData.longCommutePct}%`} />}
        </Section>
      )}

      {/* Club Competition */}
      {effectiveFactors.competition && (
        <Section title="Club Competition (10 mi)">
          <DataRow label="Registered clubs nearby" value={nearbyClubs.length} />
          {nearbyClubs.length > 0 && (
            <div className="demo-nearby-list">
              {nearbyClubs.slice(0, 5).map(c => (
                <div key={c.id} className="demo-nearby-item">
                  <span className="demo-nearby-name">{c.club_name || 'Unnamed'}</span>
                  <span className="demo-nearby-city">{c.city || ''}</span>
                </div>
              ))}
              {nearbyClubs.length > 5 && <div className="demo-nearby-more">+{nearbyClubs.length - 5} more</div>}
            </div>
          )}
          {zipData?.population && (
            <DataRow label="Saturation" value={`${(nearbyClubs.length / (zipData.population / 10000)).toFixed(1)} clubs per 10k`} />
          )}
        </Section>
      )}

      {/* Nearby competitors */}
      {effectiveFactors.competitors && competitors && (
        <Section title="Fitness Competitors (5 mi)">
          <DataRow label="Gyms, studios & health stores" value={competitors.count} />
          {competitors.items.length > 0 && (
            <div className="demo-nearby-list">
              {competitors.items.slice(0, 5).map((c, i) => (
                <div key={i} className="demo-nearby-item">
                  <span className="demo-nearby-name">{c.name}</span>
                  <span className="demo-nearby-city">{c.type}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <div className="demo-source-note">
        Data: US Census ACS 2022 · CDC PLACES · OpenStreetMap · ZIP & county level
      </div>
      </>)}
    </div>
  )
}
