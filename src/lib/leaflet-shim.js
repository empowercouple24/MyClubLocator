// Leaflet shim — proxies all imports to window.L (loaded via CDN script tag)
// Uses getters so nothing is evaluated at module parse time,
// preventing Rollup from creating temporal dead zones in merged chunks.

const handler = {
  get(_, prop) {
    const L = window.L
    const val = L?.[prop]
    if (typeof val === 'function') return val.bind(L)
    return val
  }
}

const proxy = new Proxy({}, handler)

export default proxy

export const Circle         = (...a) => new window.L.Circle(...a)
export const CircleMarker   = (...a) => new window.L.CircleMarker(...a)
export const Control        = (...a) => window.L.control(...a)
export const DomEvent       = { addListener: (...a) => window.L.DomEvent.addListener(...a), removeListener: (...a) => window.L.DomEvent.removeListener(...a), stopPropagation: (...a) => window.L.DomEvent.stopPropagation(...a), preventDefault: (...a) => window.L.DomEvent.preventDefault(...a) }
export const DomUtil        = { create: (...a) => window.L.DomUtil.create(...a), addClass: (...a) => window.L.DomUtil.addClass(...a), removeClass: (...a) => window.L.DomUtil.removeClass(...a), get: (...a) => window.L.DomUtil.get(...a) }
export const FeatureGroup   = (...a) => new window.L.FeatureGroup(...a)
export const GeoJSON        = (...a) => new window.L.GeoJSON(...a)
export const ImageOverlay   = (...a) => new window.L.ImageOverlay(...a)
export const LatLng         = (...a) => new window.L.LatLng(...a)
export const LatLngBounds   = (...a) => new window.L.LatLngBounds(...a)
export const LayerGroup     = (...a) => new window.L.LayerGroup(...a)
export const Map            = (...a) => new window.L.Map(...a)
export const Marker         = (...a) => new window.L.Marker(...a)
export const Polygon        = (...a) => new window.L.Polygon(...a)
export const Polyline       = (...a) => new window.L.Polyline(...a)
export const Popup          = (...a) => new window.L.Popup(...a)
export const Rectangle      = (...a) => new window.L.Rectangle(...a)
export const SVGOverlay     = (...a) => new window.L.SVGOverlay(...a)
export const TileLayer      = (...a) => new window.L.TileLayer(...a)
export const Tooltip        = (...a) => new window.L.Tooltip(...a)
export const VideoOverlay   = (...a) => new window.L.VideoOverlay(...a)
export const CRS            = new Proxy({}, { get(_, p) { return window.L?.CRS?.[p] } })
export const Icon           = new Proxy({}, { get(_, p) { const v = window.L?.Icon?.[p]; return typeof v === 'function' ? v.bind(window.L.Icon) : v } })

export const circle         = (...a) => window.L.circle(...a)
export const circleMarker   = (...a) => window.L.circleMarker(...a)
export const divIcon        = (...a) => window.L.divIcon(...a)
export const featureGroup   = (...a) => window.L.featureGroup(...a)
export const geoJSON        = (...a) => window.L.geoJSON(...a)
export const icon           = (...a) => window.L.icon(...a)
export const imageOverlay   = (...a) => window.L.imageOverlay(...a)
export const latLng         = (...a) => window.L.latLng(...a)
export const latLngBounds   = (...a) => window.L.latLngBounds(...a)
export const layerGroup     = (...a) => window.L.layerGroup(...a)
export const map            = (...a) => window.L.map(...a)
export const marker         = (...a) => window.L.marker(...a)
export const polygon        = (...a) => window.L.polygon(...a)
export const polyline       = (...a) => window.L.polyline(...a)
export const popup          = (...a) => window.L.popup(...a)
export const rectangle      = (...a) => window.L.rectangle(...a)
export const tileLayer      = (...a) => window.L.tileLayer(...a)
export const tooltip        = (...a) => window.L.tooltip(...a)
export const videoOverlay   = (...a) => window.L.videoOverlay(...a)
export const version        = new Proxy({}, { get() { return window.L?.version } })
