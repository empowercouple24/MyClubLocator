// ── US Census API — Demographics Service ────────────────────
// Uses American Community Survey 5-Year Estimates (ACS5)
// ZIP-level: ACS5 Subject Tables (S-series)
// County-level: ACS5 Detailed Tables (B-series) + CDC PLACES for health

const CENSUS_BASE = 'https://api.census.gov/data/2022/acs/acs5'
const CENSUS_SUBJECT = 'https://api.census.gov/data/2022/acs/acs5/subject'

// Reverse geocode lat/lng to ZIP + county FIPS using Census geocoder
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json`
    const res = await fetch(url)
    const data = await res.json()
    const result = data?.result?.geographies
    const county = result?.Counties?.[0]
    const zcta   = result?.['ZIP Code Tabulation Areas']?.[0]
    return {
      zip:        zcta?.ZCTA5 || null,
      countyFips: county ? county.STATE + county.COUNTY : null,
      countyName: county?.NAME || null,
      stateFips:  county?.STATE || null,
    }
  } catch { return null }
}

// Fetch ZIP-level demographics
export async function fetchZipData(zip, stateFips) {
  try {
    const vars = [
      'S0101_C01_001E',  // total population
      'S1901_C01_012E',  // median household income
      'S0101_C01_026E',  // median age (total)
      'S1701_C03_001E',  // poverty rate
      'S2301_C04_001E',  // unemployment rate
      'S1101_C01_001E',  // total households
      'S1101_C01_002E',  // avg household size
    ].join(',')

    const url = `${CENSUS_SUBJECT}?get=${vars}&for=zip%20code%20tabulation%20area:${zip}&key=`
    const res = await fetch(url)
    const raw = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]
    return {
      population:      safeNum(d[0]),
      medianIncome:    safeNum(d[1]),
      medianAge:       safeNum(d[2]),
      povertyRate:     safeNum(d[3]),
      unemploymentRate: safeNum(d[4]),
      households:      safeNum(d[5]),
      avgHouseholdSize: safeNum(d[6]),
    }
  } catch { return null }
}

// Fetch county-level demographics (age breakdown + income detail + health)
export async function fetchCountyData(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    const vars = [
      'B01001_001E',  // total pop
      'B01002_001E',  // median age
      'B19013_001E',  // median household income
      'B19301_001E',  // per capita income
      'B17001_002E',  // below poverty level
      'B17001_001E',  // total for poverty calc
      // Age brackets (female + male combined approach — using total pop age groups)
      'B01001_007E','B01001_008E','B01001_009E','B01001_010E', // male 18-34
      'B01001_011E','B01001_012E','B01001_013E',               // male 35-49
      'B01001_031E','B01001_032E','B01001_033E','B01001_034E', // female 18-34
      'B01001_035E','B01001_036E','B01001_037E',               // female 35-49
      'B01001_001E',                                            // total (dup for calc)
    ].join(',')

    const url = `${CENSUS_BASE}?get=${vars}&for=county:${countyOnly}&in=state:${stateFips}`
    const res = await fetch(url)
    const raw = await res.json()
    if (!raw?.[1]) return null
    const d = raw[1]

    const totalPop = safeNum(d[0])
    const povertyRate = totalPop > 0 ? ((safeNum(d[4]) / safeNum(d[5])) * 100) : null

    // Age 18-49 (core nutrition club demographic)
    const age1834 = safeNum(d[6])+safeNum(d[7])+safeNum(d[8])+safeNum(d[9])+
                    safeNum(d[12])+safeNum(d[13])+safeNum(d[14])+safeNum(d[15])
    const age3549 = safeNum(d[10])+safeNum(d[11])+safeNum(d[12])+
                    safeNum(d[16])+safeNum(d[17])+safeNum(d[18])
    const ageFitPct = totalPop > 0 ? (((age1834 + age3549) / totalPop) * 100) : null

    return {
      totalPop,
      medianAge:       safeNum(d[1]),
      medianIncome:    safeNum(d[2]),
      perCapitaIncome: safeNum(d[3]),
      povertyRate:     povertyRate,
      ageFitPct:       ageFitPct,
    }
  } catch { return null }
}

// Fetch population density using TIGER/Line area + pop
export async function fetchDensity(stateFips, countyFips) {
  if (!stateFips || !countyFips) return null
  const countyOnly = countyFips.slice(2)
  try {
    const url = `${CENSUS_BASE}?get=B01001_001E,NAME&for=county:${countyOnly}&in=state:${stateFips}`
    const res = await fetch(url)
    const raw = await res.json()
    if (!raw?.[1]) return null
    // We approximate density using known land area from Census (not in ACS, so we use a rough estimate)
    return { pop: safeNum(raw[1][0]) }
  } catch { return null }
}

// ── Market Score Calculation ──────────────────────────────
// Calculates A–F grade + numeric score from enabled factors
export function calcMarketScore(zipData, countyData, enabledFactors, nearbyClubs) {
  const scores = []

  // Income score (0-100): $80k+ = 100, $30k = 0
  if (enabledFactors.income && (zipData?.medianIncome || countyData?.medianIncome)) {
    const income = zipData?.medianIncome || countyData?.medianIncome
    const s = Math.min(100, Math.max(0, ((income - 30000) / 50000) * 100))
    scores.push({ key: 'income', score: s, weight: 2 })
  }

  // Age fit score (0-100): % of pop aged 18-49
  if (enabledFactors.ageFit && countyData?.ageFitPct != null) {
    const s = Math.min(100, (countyData.ageFitPct / 40) * 100)
    scores.push({ key: 'ageFit', score: s, weight: 2.5 })
  }

  // Population score (0-100): 50k+ = 100
  if (enabledFactors.population && (zipData?.population || countyData?.totalPop)) {
    const pop = zipData?.population || countyData?.totalPop
    const s = Math.min(100, (pop / 50000) * 100)
    scores.push({ key: 'population', score: s, weight: 1 })
  }

  // Poverty rate (inverted — lower is better): <10% = 100, >30% = 0
  if (enabledFactors.poverty && (zipData?.povertyRate || countyData?.povertyRate)) {
    const rate = zipData?.povertyRate || countyData?.povertyRate
    const s = Math.min(100, Math.max(0, ((30 - rate) / 20) * 100))
    scores.push({ key: 'poverty', score: s, weight: 1 })
  }

  // Competition score (inverted — fewer clubs = better opportunity)
  if (enabledFactors.competition) {
    const clubCount = nearbyClubs || 0
    const s = Math.max(0, 100 - (clubCount * 15))
    scores.push({ key: 'competition', score: s, weight: 1.5 })
  }

  if (scores.length === 0) return null

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const weighted = scores.reduce((sum, s) => sum + (s.score * s.weight), 0)
  const finalScore = Math.round(weighted / totalWeight)

  return {
    score: finalScore,
    grade: scoreToGrade(finalScore),
    factors: scores,
  }
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
