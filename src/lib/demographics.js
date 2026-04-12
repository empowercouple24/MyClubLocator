// ── US Census API — Demographics Service ────────────────────
const CENSUS_BASE    = 'https://api.census.gov/data/2022/acs/acs5'
const CENSUS_SUBJECT = 'https://api.census.gov/data/2022/acs/acs5/subject'

// ── All demographic categories with descriptions ─────────────
export const DEMO_CATEGORIES = {
  population:   { label: 'Population',            description: 'Total population, household count, and average household size for the ZIP code. Higher population means more potential customers walking past your door.' },
  income:       { label: 'Income & Economics',     description: 'Median household income, per capita income, poverty rate, and unemployment rate. Higher income areas tend to support premium nutrition products better.' },
  ageFit:       { label: 'Age Fit (18–49)',         description: 'The percentage of the population aged 18–49 — the core demographic for nutrition clubs. A higher percentage means more of your ideal customers live nearby.' },
  medianAge:    { label: 'Median Age',              description: 'The median age of the local population. Useful context alongside the 18–49 age fit percentage to understand the full age profile of an area.' },
  poverty:      { label: 'Poverty Rate',            description: 'The percentage of residents living below the poverty line. Lower poverty rates generally indicate stronger discretionary spending on health products.' },
  competition:  { label: 'Club Competition',        description: 'The number of registered nutrition clubs within a 10-mile radius, plus a saturation score (clubs per 10,000 people). Fewer clubs = more opportunity.' },
  health:       { label: 'Health Indicators',       description: 'CDC PLACES data showing obesity rate, physical inactivity, diabetes prevalence, and high blood pressure rates. Higher rates often indicate stronger need and demand for nutrition interventions.' },
  spending:     { label: 'Consumer Spending',       description: 'Census data on how much households in this area spend on food away from home, health and fitness, and personal care. Higher health spending = more receptive market.' },
  growth:       { label: 'Population Growth',       description: 'Whether the local population is growing, stable, or declining based on Census estimates. Growing areas represent expanding future customer bases.' },
  commute:      { label: 'Commute & Walkability',   description: 'How residents get to work — walking, driving, transit. High foot-traffic and walkable areas tend to drive more spontaneous drop-ins at nutrition clubs.' },
  competitors:  { label: 'Nearby Competitors',      description: 'Gyms, fitness centers, yoga studios, and health food stores within the area from OpenStreetMap. More fitness businesses nearby = more health-conscious population.' },
}

export const DEFAULT_ENABLED_FACTORS = Object.fromEntries(
  Object.keys(DEMO_CATEGORIES).map(k => [k, true])
)

// Reverse geocode lat/lng to ZIP + county FIPS
export async function reverseGeocode(lat, lng) {
  // Try two vintages for compatibility
  const vintages = ['Census2020_Current', 'Current_Current']

  for (const vintage of vintages) {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=${vintage}&layers=Counties,2020+ZIP+Code+Tabulation+Areas&format=json`

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) { await new Promise(r => setTimeout(r, 600)); continue }
        const data = await res.json()
        const result = data?.result?.geographies
        const county = result?.Counties?.[0]
        const zcta = result?.['2020 ZIP Code Tabulation Areas']?.[0]
          || result?.['ZIP Code Tabulation Areas']?.[0]
          || result?.['2010 ZIP Code Tabulation Areas']?.[0]

        if (!county) {
          if (attempt < 1) { await new Promise(r => setTimeout(r, 600)); continue }
          break
        }

        return {
          zip:        zcta?.ZCTA5 || null,
          countyFips: county.STATE + county.COUNTY,
          countyName: county.NAME || null,
          stateFips:  county.STATE || null,
        }
      } catch {
        if (attempt < 1) await new Promise(r => setTimeout(r, 600))
      }
    }
  }
  return null
}

// Fetch ZIP-level demographics
export async function fetchZipData(zip) {
  try {
    const vars = [
      'S0101_C01_001E', 'S1901_C01_012E', 'S0101_C01_026E',
      'S1701_C03_001E', 'S2301_C04_001E', 'S1101_C01_001E', 'S1101_C01_002E',
    ].join(',')
    const res = await fetch(`${CENSUS_SUBJECT}?get=${vars}&for=zip%20code%20tabulation%20area:${zip}`)
    const raw = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]
    return {
      population:       safeNum(d[0]),
      medianIncome:     safeNum(d[1]),
      medianAge:        safeNum(d[2]),
      povertyRate:      safeNum(d[3]),
      unemploymentRate: safeNum(d[4]),
      households:       safeNum(d[5]),
      avgHouseholdSize: safeNum(d[6]),
    }
  } catch { return null }
}

// Fetch county-level demographics
export async function fetchCountyData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    const vars = [
      'B01001_001E','B01002_001E','B19013_001E','B19301_001E',
      'B17001_002E','B17001_001E',
      'B01001_007E','B01001_008E','B01001_009E','B01001_010E',
      'B01001_011E','B01001_012E','B01001_013E',
      'B01001_031E','B01001_032E','B01001_033E','B01001_034E',
      'B01001_035E','B01001_036E','B01001_037E',
    ].join(',')
    const res = await fetch(`${CENSUS_BASE}?get=${vars}&for=county:${countyOnly}&in=state:${stateFips}`)
    const raw = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]
    const totalPop   = safeNum(d[0])
    const povertyRate = totalPop > 0 ? ((safeNum(d[4]) / safeNum(d[5])) * 100) : null
    const age1834 = safeNum(d[6])+safeNum(d[7])+safeNum(d[8])+safeNum(d[9])+safeNum(d[13])+safeNum(d[14])+safeNum(d[15])+safeNum(d[16])
    const age3549 = safeNum(d[10])+safeNum(d[11])+safeNum(d[12])+safeNum(d[17])+safeNum(d[18])+safeNum(d[19])
    const ageFitPct = totalPop > 0 ? (((age1834 + age3549) / totalPop) * 100) : null
    return { totalPop, medianAge: safeNum(d[1]), medianIncome: safeNum(d[2]), perCapitaIncome: safeNum(d[3]), povertyRate, ageFitPct }
  } catch { return null }
}

// Fetch CDC PLACES health indicators (county level)
export async function fetchHealthData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  try {
    // CDC PLACES 2023 release — county level data
    // countyFips is full 5-digit FIPS e.g. "17031"
    const url = `https://data.cdc.gov/resource/swc5-untb.json?countyfips=${countyFips}&$limit=50`
    const res  = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.length) return null
    const measures = {}
    data.forEach(row => {
      const id = row.measureid || row.measure_id
      const val = parseFloat(row.data_value ?? row.datavalue)
      if (id && !isNaN(val)) measures[id] = val
    })
    return {
      obesity:      measures['OBESITY']    ?? measures['Obesity']    ?? null,
      inactivity:   measures['LPA']        ?? measures['lpa']        ?? null,
      diabetes:     measures['DIABETES']   ?? measures['Diabetes']   ?? null,
      highBP:       measures['BPHIGH']     ?? measures['bphigh']     ?? null,
      mentalHealth: measures['MHLTH']      ?? measures['mhlth']      ?? null,
    }
  } catch { return null }
}

// Fetch consumer spending proxy from Census (food/health expenditure)
export async function fetchSpendingData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    // Use per capita income + median income as spending proxy
    // Census doesn't have direct consumer expenditure at county level
    // We use B19051 (earnings), B19052 (wage), B19054 (interest) as spending proxies
    const vars = ['B19051_001E', 'B19052_001E', 'B19301_001E', 'B19013_001E'].join(',')
    const res  = await fetch(`${CENSUS_BASE}?get=${vars}&for=county:${countyOnly}&in=state:${stateFips}`)
    const raw  = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]
    const perCapita   = safeNum(d[2])
    const medIncome   = safeNum(d[3])
    // Estimate health spending: ~5-8% of income typically goes to health
    const estHealthSpend = perCapita ? Math.round(perCapita * 0.065) : null
    const estFoodSpend   = medIncome  ? Math.round(medIncome  * 0.12)  : null
    return {
      estimatedHealthSpend: estHealthSpend,
      estimatedFoodSpend:   estFoodSpend,
      perCapitaIncome:      perCapita,
      spendingIndex: perCapita ? Math.min(100, Math.round((perCapita / 60000) * 100)) : null,
    }
  } catch { return null }
}

// Fetch population growth trend
export async function fetchGrowthData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    // Compare 2022 vs 2019 ACS estimates
    const [res22, res19] = await Promise.all([
      fetch(`${CENSUS_BASE}?get=B01001_001E&for=county:${countyOnly}&in=state:${stateFips}`),
      fetch(`https://api.census.gov/data/2019/acs/acs5?get=B01001_001E&for=county:${countyOnly}&in=state:${stateFips}`),
    ])
    const [raw22, raw19] = await Promise.all([res22.json(), res19.json()])
    const pop22 = safeNum(raw22?.[1]?.[0])
    const pop19 = safeNum(raw19?.[1]?.[0])
    if (!pop22 || !pop19) return null
    const growthPct = ((pop22 - pop19) / pop19) * 100
    return {
      pop2022: pop22,
      pop2019: pop19,
      growthPct: Math.round(growthPct * 10) / 10,
      trend: growthPct > 2 ? 'growing' : growthPct < -2 ? 'declining' : 'stable',
    }
  } catch { return null }
}

// Fetch commute/walkability data
export async function fetchCommuteData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    // B08301: means of transportation to work
    const vars = [
      'B08301_001E', // total workers
      'B08301_003E', // drove alone
      'B08301_010E', // public transit
      'B08301_019E', // walked
      'B08303_001E', // total commute time
      'B08303_013E', // 60+ min commute
    ].join(',')
    const res = await fetch(`${CENSUS_BASE}?get=${vars}&for=county:${countyOnly}&in=state:${stateFips}`)
    const raw = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]
    const total = safeNum(d[0])
    return {
      totalWorkers:  total,
      drovePct:      total ? Math.round((safeNum(d[1]) / total) * 100) : null,
      transitPct:    total ? Math.round((safeNum(d[2]) / total) * 100) : null,
      walkedPct:     total ? Math.round((safeNum(d[3]) / total) * 100) : null,
      longCommutePct: safeNum(d[4]) ? Math.round((safeNum(d[5]) / safeNum(d[4])) * 100) : null,
    }
  } catch { return null }
}

// Fetch nearby fitness competitors via Overpass API (OpenStreetMap)
export async function fetchCompetitors(lat, lng, radiusMiles = 5) {
  try {
    const radiusMeters = radiusMiles * 1609.34
    const query = `
      [out:json][timeout:10];
      (
        node["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
        node["leisure"="gym"](around:${radiusMeters},${lat},${lng});
        node["sport"="yoga"](around:${radiusMeters},${lat},${lng});
        node["shop"="health_food"](around:${radiusMeters},${lat},${lng});
        node["shop"="nutrition_supplements"](around:${radiusMeters},${lat},${lng});
        way["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
        way["leisure"="gym"](around:${radiusMeters},${lat},${lng});
      );
      out center 20;
    `
    const res  = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    })
    const data = await res.json()
    const items = (data.elements || []).map(el => ({
      name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed',
      type: el.tags?.leisure || el.tags?.sport || el.tags?.shop || 'fitness',
    }))
    return { count: items.length, items: items.slice(0, 8) }
  } catch { return null }
}

// ── Market Score ──────────────────────────────────────────────
export function calcMarketScore(zipData, countyData, enabledFactors, nearbyClubs, healthData, growthData, spendingData) {
  const scores = []

  if (enabledFactors.income && (zipData?.medianIncome || countyData?.medianIncome)) {
    const income = zipData?.medianIncome || countyData?.medianIncome
    scores.push({ key: 'income', score: Math.min(100, Math.max(0, ((income - 30000) / 50000) * 100)), weight: 2 })
  }
  if (enabledFactors.ageFit && countyData?.ageFitPct != null) {
    scores.push({ key: 'ageFit', score: Math.min(100, (countyData.ageFitPct / 40) * 100), weight: 2.5 })
  }
  if (enabledFactors.population && (zipData?.population || countyData?.totalPop)) {
    const pop = zipData?.population || countyData?.totalPop
    scores.push({ key: 'population', score: Math.min(100, (pop / 50000) * 100), weight: 1 })
  }
  if (enabledFactors.poverty && (zipData?.povertyRate || countyData?.povertyRate)) {
    const rate = zipData?.povertyRate || countyData?.povertyRate
    scores.push({ key: 'poverty', score: Math.min(100, Math.max(0, ((30 - rate) / 20) * 100)), weight: 1 })
  }
  if (enabledFactors.competition) {
    scores.push({ key: 'competition', score: Math.max(0, 100 - ((nearbyClubs || 0) * 15)), weight: 1.5 })
  }
  if (enabledFactors.health && healthData?.obesity != null) {
    // Higher obesity = better market for nutrition intervention
    const s = Math.min(100, (healthData.obesity / 40) * 100)
    scores.push({ key: 'health', score: s, weight: 1.5 })
  }
  if (enabledFactors.spending && spendingData?.spendingIndex != null) {
    scores.push({ key: 'spending', score: spendingData.spendingIndex, weight: 1.5 })
  }
  if (enabledFactors.growth && growthData?.growthPct != null) {
    const s = growthData.trend === 'growing' ? 80 : growthData.trend === 'stable' ? 50 : 20
    scores.push({ key: 'growth', score: s, weight: 1 })
  }

  if (scores.length === 0) return null
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const weighted    = scores.reduce((sum, s) => sum + (s.score * s.weight), 0)
  const finalScore  = Math.round(weighted / totalWeight)
  return { score: finalScore, grade: scoreToGrade(finalScore), factors: scores }
}

function scoreToGrade(score) {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'A-'
  if (score >= 77) return 'B+'
  if (score >= 73) return 'B'
  if (score >= 70) return 'B-'
  if (score >= 67) return 'C+'
  if (score >= 63) return 'C'
  if (score >= 60) return 'C-'
  if (score >= 57) return 'D+'
  if (score >= 53) return 'D'
  if (score >= 50) return 'D-'
  return 'F'
}

function safeNum(v) {
  const n = parseFloat(v)
  return isNaN(n) || n < 0 ? null : n
}

export function formatCurrency(n) {
  if (n == null) return 'N/A'
  return '$' + Math.round(n).toLocaleString()
}

export function formatPct(n, decimals = 1) {
  if (n == null) return 'N/A'
  return n.toFixed(decimals) + '%'
}

export function formatNum(n) {
  if (n == null) return 'N/A'
  return Math.round(n).toLocaleString()
}
