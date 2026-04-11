import { useState, useRef, useEffect } from 'react'

// Generates times at 15-min intervals: 5:00 AM … 11:45 PM
function buildTimeOptions() {
  const options = []
  for (let h = 5; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      const period = h < 12 ? 'AM' : 'PM'
      const display12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const label = `${display12}:${String(m).padStart(2,'0')} ${period}`
      const value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      options.push({ label, value, hour: h, minute: m })
    }
  }
  return options
}

const ALL_TIMES = buildTimeOptions()

// Group by hour for column display
function groupByHour(times) {
  const groups = {}
  times.forEach(t => {
    if (!groups[t.hour]) groups[t.hour] = []
    groups[t.hour].push(t)
  })
  return Object.values(groups)
}

const HOUR_GROUPS = groupByHour(ALL_TIMES)

function formatDisplay(value) {
  if (!value) return ''
  const match = ALL_TIMES.find(t => t.value === value)
  return match ? match.label : value
}

export default function TimePicker({ value, onChange, placeholder = 'Select time' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(val) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div className="tp-wrap" ref={ref}>
      <button
        type="button"
        className={`tp-trigger ${value ? 'has-value' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{value ? formatDisplay(value) : <span className="tp-placeholder">{placeholder}</span>}</span>
        <span className="tp-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="tp-dropdown">
          <div className="tp-grid">
            {HOUR_GROUPS.map(group => (
              <div key={group[0].hour} className="tp-hour-col">
                {group.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`tp-option ${value === t.value ? 'selected' : ''}`}
                    onClick={() => select(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {value && (
            <button type="button" className="tp-clear" onClick={() => { onChange(''); setOpen(false) }}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
