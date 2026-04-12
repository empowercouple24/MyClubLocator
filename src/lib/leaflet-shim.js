// Re-exports window.L (CDN-loaded Leaflet) as named and default exports
// This prevents Rollup from bundling Leaflet's UMD source and causing TDZ errors
const L = window.L

export default L

// Classes / constructors
export const Circle = L?.Circle
export const CircleMarker = L?.CircleMarker
export const Control = L?.Control
export const DomEvent = L?.DomEvent
export const DomUtil = L?.DomUtil
export const FeatureGroup = L?.FeatureGroup
export const GeoJSON = L?.GeoJSON
export const Icon = L?.Icon
export const ImageOverlay = L?.ImageOverlay
export const LatLng = L?.LatLng
export const LatLngBounds = L?.LatLngBounds
export const LayerGroup = L?.LayerGroup
export const Map = L?.Map
export const Marker = L?.Marker
export const Polygon = L?.Polygon
export const Polyline = L?.Polyline
export const Popup = L?.Popup
export const Rectangle = L?.Rectangle
export const SVGOverlay = L?.SVGOverlay
export const TileLayer = L?.TileLayer
export const Tooltip = L?.Tooltip
export const VideoOverlay = L?.VideoOverlay
export const CRS = L?.CRS

// Factory functions
export const circle = (...a) => L.circle(...a)
export const circleMarker = (...a) => L.circleMarker(...a)
export const divIcon = (...a) => L.divIcon(...a)
export const featureGroup = (...a) => L.featureGroup(...a)
export const geoJSON = (...a) => L.geoJSON(...a)
export const icon = (...a) => L.icon(...a)
export const imageOverlay = (...a) => L.imageOverlay(...a)
export const latLng = (...a) => L.latLng(...a)
export const latLngBounds = (...a) => L.latLngBounds(...a)
export const layerGroup = (...a) => L.layerGroup(...a)
export const map = (...a) => L.map(...a)
export const marker = (...a) => L.marker(...a)
export const polygon = (...a) => L.polygon(...a)
export const polyline = (...a) => L.polyline(...a)
export const popup = (...a) => L.popup(...a)
export const rectangle = (...a) => L.rectangle(...a)
export const tileLayer = (...a) => L.tileLayer(...a)
export const tooltip = (...a) => L.tooltip(...a)
export const videoOverlay = (...a) => L.videoOverlay(...a)

export const version = L?.version
