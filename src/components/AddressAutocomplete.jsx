import { useState, useRef, useEffect, useCallback } from 'react'
import { geocodeAutocomplete } from '../lib/geocode'

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export default function AddressAutocomplete({ value, onChange, onSelect, error, tabIndex }) {
  const [query, setQuery]           = useState(value || '')
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const wrapRef = useRef()
  const inputRef = useRef()

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(
    debounce(async (q) => {
      if (q.length < 3) { setResults([]); setOpen(false); return }
      setLoading(true)
      const data = await geocodeAutocomplete(q, { types: 'address,place,postcode', limit: 6 })
      setResults(data)
      setOpen(data.length > 0)
      setHighlighted(-1)
      setLoading(false)
    }, 350),
    []
  )

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange(q)
    search(q)
  }

  function handleSelect(result) {
    setQuery(result.displayStreet || result.label.split(',')[0])
    setOpen(false)
    setResults([])
    onSelect({
      street: result.street,
      city:   result.city,
      state:  result.state,
      zip:    result.zip,
      lat:    result.lat,
      lng:    result.lng,
    })
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
          {results.map((r, i) => (
            <li
              key={r.id}
              className={`addr-ac-item${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={() => handleSelect(r)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="addr-ac-street">📍 {r.displayStreet}</span>
              {r.displaySecondary && <span className="addr-ac-secondary">{r.displaySecondary}</span>}
            </li>
          ))}
          <li className="addr-ac-credit">Powered by Mapbox</li>
        </ul>
      )}
    </div>
  )
}
