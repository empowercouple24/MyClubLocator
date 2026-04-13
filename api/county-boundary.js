// Vercel serverless function — proxies TigerWeb county boundary to bypass CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { state, county } = req.query
  if (!state || !county) return res.status(400).json({ error: 'state and county required' })

  const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2022/MapServer/82/query?where=STATE%3D%27${state}%27+AND+COUNTY%3D%27${county}%27&outFields=*&f=geojson`

  try {
    const response = await fetch(url)
    if (!response.ok) return res.status(response.status).json({ error: 'TigerWeb API error' })
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
