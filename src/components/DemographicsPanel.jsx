import { useState, useEffect } from 'react'
import { reverseGeocode, fetchZipData, fetchCountyData, calcMarketScore, formatCurrency, formatPct, formatNum } from '../lib/demographics'

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

export default function DemographicsPanel({ lat, lng, locations, enabledFactors, active }) {
  const [loading, setLoading]     = useState(false)
  const [geoInfo, setGeoInfo]     = useState(null)
  const [zipData, setZipData]     = useState(null)
  const [countyData, setCountyData] = useState(null)
  const [marketScore, setMarketScore] = useState(null)
  const [error, setError]         = useState(null)
  const [prompted, setPrompted]   = useState(true) // show prompt until area clicked

  // Reset when lat/lng changes (new area clicked)
  useEffect(() => {
    if (!active) return
    if (lat == null || lng == null) { setPrompted(true); return }
    setPrompted(false)
    loadData(lat, lng)
  }, [lat, lng, active])

  async function loadData(lat, lng) {
    setLoading(true)
    setError(null)
    setZipData(null)
    setCountyData(null)
    setMarketScore(null)

    const geo = await reverseGeocode(lat, lng)
    if (!geo) { setError('Could not identify this location. Try clicking closer to a populated area.'); setLoading(false); return }
    setGeoInfo(geo)

    const [zip, county] = await Promise.all([
      geo.zip ? fetchZipData(geo.zip, geo.stateFips) : null,
      geo.stateFips && geo.countyFips ? fetchCountyData(geo.stateFips, geo.countyFips) : null,
    ])

    setZipData(zip)
    setCountyData(county)

    // Count nearby clubs (within ~10 miles of clicked point)
    const nearbyCount = locations.filter(loc => {
      if (!loc.lat || !loc.lng) return false
      const R = 3958.8
      const dLat = (loc.lat - lat) * Math.PI / 180
      const dLng = (loc.lng - lng) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      return dist <= 10
    }).length

    const score = calcMarketScore(zip, county, enabledFactors, nearbyCount)
    setMarketScore(score)
    setLoading(false)
  }

  function getSignalTags(zip, county, score) {
    const tags = []
    const income = zip?.medianIncome || county?.medianIncome
    const age    = county?.ageFitPct
    const pop    = zip?.population || county?.totalPop
    const poverty = zip?.povertyRate || county?.povertyRate

    if (income != null) {
      if (income >= 75000)      tags.push({ label: 'Strong income', type: 'good' })
      else if (income >= 50000) tags.push({ label: 'Moderate income', type: 'neutral' })
      else                      tags.push({ label: 'Lower income area', type: 'warn' })
    }
    if (age != null) {
      if (age >= 35)       tags.push({ label: 'Great age fit', type: 'good' })
      else if (age >= 28)  tags.push({ label: 'Good age fit', type: 'neutral' })
      else                 tags.push({ label: 'Older demographic', type: 'warn' })
    }
    if (pop != null) {
      if (pop >= 30000)      tags.push({ label: 'High density', type: 'good' })
      else if (pop >= 10000) tags.push({ label: 'Medium density', type: 'neutral' })
      else                   tags.push({ label: 'Low density', type: 'warn' })
    }
    if (poverty != null && poverty > 20) tags.push({ label: 'High poverty rate', type: 'warn' })

    const nearbyCount = locations.filter(loc => {
      if (!loc.lat || !loc.lng || !lat || !lng) return false
      const R = 3958.8
      const dLat = (loc.lat - lat) * Math.PI / 180
      const dLng = (loc.lng - lng) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= 10
    }).length

    if (nearbyCount === 0)      tags.push({ label: 'No nearby clubs', type: 'good' })
    else if (nearbyCount <= 2)  tags.push({ label: `${nearbyCount} club${nearbyCount > 1 ? 's' : ''} nearby`, type: 'neutral' })
    else                        tags.push({ label: `${nearbyCount} clubs nearby`, type: 'warn' })

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
        <span>Loading demographic data…</span>
      </div>
    )
  }

  if (error) {
    return <div className="demo-error">{error}</div>
  }

  const noData = !zipData && !countyData
  if (noData) {
    return <div className="demo-error">No census data found for this area.</div>
  }

  const tags = getSignalTags(zipData, countyData, marketScore)
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

      {/* Location header */}
      {geoInfo && (
        <div className="demo-location-header">
          <span className="demo-zip">{geoInfo.zip ? `ZIP ${geoInfo.zip}` : 'Area'}</span>
          {geoInfo.countyName && <span className="demo-county">{geoInfo.countyName}</span>}
        </div>
      )}

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

      {/* Population */}
      {enabledFactors.population && (
        <Section title="Population">
          {zipData?.population != null && <DataRow label="ZIP population" value={formatNum(zipData.population)} />}
          {countyData?.totalPop != null && <DataRow label="County population" value={formatNum(countyData.totalPop)} />}
          {zipData?.households != null && <DataRow label="Households" value={formatNum(zipData.households)} />}
          {zipData?.avgHouseholdSize != null && <DataRow label="Avg household size" value={zipData.avgHouseholdSize?.toFixed(1)} />}
        </Section>
      )}

      {/* Income */}
      {enabledFactors.income && (
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
      {enabledFactors.ageFit && (
        <Section title="Age Profile" countyNote>
          {countyData?.medianAge != null && <DataRow label="Median age" value={`${countyData.medianAge} yrs`} />}
          {countyData?.ageFitPct != null && (
            <DataRow label="Ages 18–49 (target)" value={formatPct(countyData.ageFitPct)}
              note="Core nutrition club demographic" />
          )}
        </Section>
      )}

      {/* Competition */}
      {enabledFactors.competition && (
        <Section title="Club Competition (10 mi radius)">
          <DataRow label="Registered clubs nearby" value={nearbyClubs.length} />
          {nearbyClubs.length > 0 && (
            <div className="demo-nearby-list">
              {nearbyClubs.slice(0, 5).map(c => (
                <div key={c.id} className="demo-nearby-item">
                  <span className="demo-nearby-name">{c.business_name || 'Unnamed'}</span>
                  <span className="demo-nearby-city">{c.city || ''}</span>
                </div>
              ))}
              {nearbyClubs.length > 5 && (
                <div className="demo-nearby-more">+{nearbyClubs.length - 5} more</div>
              )}
            </div>
          )}
          {zipData?.population && nearbyClubs.length >= 0 && (
            <DataRow label="Saturation"
              value={`${(nearbyClubs.length / (zipData.population / 10000)).toFixed(1)} clubs per 10k`} />
          )}
        </Section>
      )}

      <div className="demo-source-note">
        Data: US Census ACS 2022 · ZIP & county level · Health data is county-level only
      </div>
    </div>
  )
}
