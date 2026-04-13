// Re-exports leaflet's ESM build (uses only `var`, no TDZ issues)
// Named exports only — no default export to avoid namespace binding issues
export * from '../../node_modules/leaflet/dist/leaflet-src.esm.js'
