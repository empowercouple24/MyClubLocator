import { useState, useRef, useEffect, useCallback } from 'react'

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export default function AddressAutocomplete({ value, onChange, onSelect, error, tabIndex }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapRef = useRef()
  const inputRef = useRef()

  // Sync if parent changes value externally
  useEffect(() => { setQuery(value || '') }, [value])

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
      if (q.length < 4) { setResults([]); setOpen(false); return }
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=us&addressdetails=1&limit=6`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        const filtered = data.filter(r => r.address?.road || r.address?.house_number)
        setResults(filtered)
        setOpen(filtered.length > 0)
        setHighlighted(-1)
      } catch {}
      setLoading(false)
    }, 350),
    []
  )

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q) // keep parent address field in sync while typing
    search(q)
  }

  function handleSelect(result) {
    const addr = result.address || {}

    // Build street line
    const street = [addr.house_number, addr.road].filter(Boolean).join(' ')
    const city   = addr.city || addr.town || addr.village || addr.county || ''
    const state  = addr.state || ''
    const zip    = addr.postcode || ''

    setQuery(street)
    setOpen(false)
    setResults([])

    onSelect({ street, city, state, zip, lat: parseFloat(result.lat), lng: parseFloat(result.lon) })
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function formatSuggestion(result) {
    const addr = result.address || {}
    const street = [addr.house_number, addr.road].filter(Boolean).join(' ')
    const city   = addr.city || addr.town || addr.village || ''
    const state  = addr.state || ''
    const zip    = addr.postcode || ''
    return { street, secondary: [city, state, zip].filter(Boolean).join(', ') }
  }

  return (
    <div className="addr-ac-wrap" ref={wrapRef}>
      <div className="addr-ac-input-row">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Start typing your address…"
          tabIndex={tabIndex !== undefined ? tabIndex : 1}
          autoComplete="off"
          className={`addr-ac-input${error ? ' input-err' : ''}`}
        />
        {loading && <span className="addr-ac-spinner">⟳</span>}
      </div>

      {open && results.length > 0 && (
        <ul className="addr-ac-list">
          {results.map((r, i) => {
            const { street, secondary } = formatSuggestion(r)
            return (
              <li
                key={r.place_id}
                className={`addr-ac-item${i === highlighted ? ' highlighted' : ''}`}
                onMouseDown={() => handleSelect(r)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className="addr-ac-street">📍 {street || r.display_name.split(',')[0]}</span>
                {secondary && <span className="addr-ac-secondary">{secondary}</span>}
              </li>
            )
          })}
          <li className="addr-ac-credit">Powered by OpenStreetMap</li>
        </ul>
      )}
    </div>
  )
}
