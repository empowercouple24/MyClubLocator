import { useState, useRef, useEffect, useCallback } from 'react'
import { geocodeAutocomplete } from '../lib/geocode'

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export default function MapSearchAutocomplete({ value, onChange, onSelect, onClear, geocoding }) {
  const [results, setResults]       = useState([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapRef = useRef()

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
      const data = await geocodeAutocomplete(q, { types: 'place,address,postcode,region', limit: 6 })
      setResults(data)
      setOpen(data.length > 0)
      setHighlighted(-1)
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
    const label = result.city && result.state
      ? `${result.city}, ${result.state}`
      : result.label.split(',').slice(0, 2).join(',').trim()
    onChange(label)
    setOpen(false)
    setResults([])
    onSelect({ label, lat: result.lat, lng: result.lng })
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
      if (highlighted >= 0) handleSelect(results[highlighted])
      else setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
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
            onClick={() => { onChange(''); setResults([]); setOpen(false); onClear?.() }}
            title="Clear search"
          >✕</button>
        )}
        <button className="map-search-btn" type="submit" disabled={spinner}>
          {spinner ? '…' : '⌕'}
        </button>
      </div>

      {open && results.length > 0 && (
        <ul className="msa-list">
          {results.map((r, i) => (
            <li
              key={r.id}
              className={`msa-item${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="msa-primary">📍 {r.displayStreet || r.city || r.label.split(',')[0]}</span>
              {r.displaySecondary && <span className="msa-secondary">{r.displaySecondary}</span>}
            </li>
          ))}
          <li className="msa-credit">Powered by Mapbox</li>
        </ul>
      )}
    </div>
  )
}
