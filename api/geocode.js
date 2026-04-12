// Vercel serverless function — proxies Census Geocoder to bypass CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { x, y, vintage } = req.query
  if (!x || !y) return res.status(400).json({ error: 'x and y required' })

  const v = vintage || 'Census2020_Current'
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${x}&y=${y}&benchmark=Public_AR_Current&vintage=${v}&layers=Counties,2020+ZIP+Code+Tabulation+Areas&format=json`

  try {
    const response = await fetch(url)
    if (!response.ok) return res.status(response.status).json({ error: 'Census API error' })
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
