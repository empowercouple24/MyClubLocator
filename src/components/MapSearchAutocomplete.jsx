import { useState, useRef, useEffect, useCallback } from 'react'

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/**
 * MapSearchAutocomplete
 * Lightweight city/place search for the map toolbar.
 * onSelect({ label, lat, lng }) — caller pans the map.
 */
export default function MapSearchAutocomplete({ value, onChange, onSelect, onClear, geocoding }) {
  const [results, setResults]       = useState([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapRef = useRef()

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(
    debounce(async (q) => {
      if (q.length < 2) { setResults([]); setOpen(false); return }
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=us&addressdetails=1&limit=6`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        setResults(data)
        setOpen(data.length > 0)
        setHighlighted(-1)
      } catch {}
      setLoading(false)
    }, 300),
    []
  )

  function handleChange(e) {
    const q = e.target.value
    onChange(q)
    if (!q) { setResults([]); setOpen(false); return }
    search(q)
  }

  function handleSelect(result) {
    const addr   = result.address || {}
    const city   = addr.city || addr.town || addr.village || addr.county || ''
    const state  = addr.state || ''
    const label  = city && state ? `${city}, ${state}` : result.display_name.split(',').slice(0, 2).join(',')
    onChange(label)
    setOpen(false)
    setResults([])
    onSelect({ label, lat: parseFloat(result.lat), lng: parseFloat(result.lon) })
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0) {
        handleSelect(results[highlighted])
      } else {
        // Fall back to existing geocode-on-submit behaviour
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function formatResult(result) {
    const addr  = result.address || {}
    const city  = addr.city || addr.town || addr.village || addr.county || result.display_name.split(',')[0]
    const state = addr.state || ''
    const zip   = addr.postcode || ''
    const secondary = [state, zip].filter(Boolean).join(' ')
    return { primary: city, secondary }
  }

  const spinner = loading || geocoding

  return (
    <div className="msa-wrap" ref={wrapRef}>
      <div className="msa-input-row">
        <input
          className="map-search-input"
          type="text"
          placeholder="Search city, state, or zip…"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {value && (
          <button
            className="msa-clear-btn"
            type="button"
            onClick={() => { onChange(''); setResults([]); setOpen(false); onClear && onClear() }}
            title="Clear search"
          >✕</button>
        )}
        <button className="map-search-btn" type="submit" disabled={spinner}>
          {spinner ? '…' : '⌕'}
        </button>
      </div>

      {open && results.length > 0 && (
        <ul className="msa-list">
          {results.map((r, i) => {
            const { primary, secondary } = formatResult(r)
            return (
              <li
                key={r.place_id}
                className={`msa-item${i === highlighted ? ' highlighted' : ''}`}
                onMouseDown={() => handleSelect(r)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className="msa-primary">📍 {primary}</span>
                {secondary && <span className="msa-secondary">{secondary}</span>}
              </li>
            )
          })}
          <li className="msa-credit">Powered by OpenStreetMap</li>
        </ul>
      )}
    </div>
  )
}
