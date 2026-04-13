const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
if (!TOKEN) console.warn('[MyClubLocator] VITE_MAPBOX_TOKEN is not set — map search will not work. Add it to your Vercel environment variables.')
const BASE  = 'https://api.mapbox.com/geocoding/v5/mapbox.places'

// Parse a Mapbox feature's context array into { city, state, stateAbbr, zip, country }
function parseContext(feature) {
  const ctx = feature.context || []
  let city = '', state = '', stateAbbr = '', zip = ''
  for (const c of ctx) {
    if (c.id.startsWith('place.'))     city      = c.text || ''
    if (c.id.startsWith('region.'))  { state     = c.text || ''; stateAbbr = c.short_code?.replace('US-','') || '' }
    if (c.id.startsWith('postcode.'))  zip       = c.text || ''
    if (c.id.startsWith('locality.') && !city) city = c.text || ''
    if (c.id.startsWith('district.') && !city) city = c.text || ''
  }
  return { city, state, stateAbbr, zip }
}

// Parse street from feature
function parseStreet(feature) {
  const num  = feature.address || ''
  const road = feature.text    || ''
  return [num, road].filter(Boolean).join(' ')
}

/**
 * Autocomplete search — returns array of result objects ready for display + selection.
 * Each result: { id, displayStreet, displaySecondary, label, street, city, state, zip, lat, lng }
 * proximity: { lat, lng } — optional, biases results toward this location
 */
export async function geocodeAutocomplete(query, { types = 'address,place,postcode', limit = 6, proximity = null } = {}) {
  if (!TOKEN || query.length < 3) return []
  try {
    let url = `${BASE}/${encodeURIComponent(query)}.json?access_token=${TOKEN}&country=US&types=${types}&limit=${limit}&language=en`
    if (proximity?.lng && proximity?.lat) {
      url += `&proximity=${proximity.lng},${proximity.lat}`
    }
    const res  = await fetch(url)
    const data = await res.json()
    if (!data.features?.length) return []
    return data.features.map(f => {
      const { city, state, stateAbbr, zip } = parseContext(f)
      const street = parseStreet(f)
      const [lng, lat] = f.center
      const secondary = [city, stateAbbr || state, zip].filter(Boolean).join(', ')
      return {
        id:               f.id,
        displayStreet:    street || f.text || f.place_name.split(',')[0],
        displaySecondary: secondary,
        label:            f.place_name,
        street, city,
        state:            stateAbbr || state,
        zip,
        lat, lng,
      }
    })
  } catch {
    return []
  }
}

/**
 * Single geocode — returns { lat, lng } or null.
 * Used for form submits / ZIP lookups / one-shot searches.
 */
export async function geocodeSingle(query) {
  if (!TOKEN || !query.trim()) return null
  try {
    const url = `${BASE}/${encodeURIComponent(query)}.json?access_token=${TOKEN}&country=US&limit=1&language=en`
    const res  = await fetch(url)
    const data = await res.json()
    if (!data.features?.length) return null
    const [lng, lat] = data.features[0].center
    return { lat, lng }
  } catch {
    return null
  }
}

/**
 * ZIP lookup — returns { city, state } or null.
 * Used when user enters a ZIP and we want to auto-fill city/state.
 */
export async function geocodeZip(zip) {
  if (!TOKEN || zip.length < 5) return null
  try {
    const url = `${BASE}/${encodeURIComponent(zip)}.json?access_token=${TOKEN}&country=US&types=postcode&limit=1&language=en`
    const res  = await fetch(url)
    const data = await res.json()
    if (!data.features?.length) return null
    const f = data.features[0]
    const { city, state, stateAbbr } = parseContext(f)
    // For postcodes, city is sometimes the feature text itself
    const resolvedCity = city || f.text || ''
    return { city: resolvedCity, state: stateAbbr || state }
  } catch {
    return null
  }
}
