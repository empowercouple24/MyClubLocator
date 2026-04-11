import { useState, useRef, useEffect } from 'react'

const HOURS   = ['6','7','8','9','10','11','12','1','2','3','4','5']
const MINUTES = ['00','15','30','45']
const PERIODS = ['AM','PM']

function parseValue(value) {
  if (!value) return { hour: null, minute: null, period: null }
  const [h, m] = value.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour   = h === 0 ? '12' : h > 12 ? String(h - 12) : String(h)
  const minute = String(m).padStart(2, '0')
  return { hour, minute, period }
}

function toValue(hour, minute, period) {
  if (!hour || !minute || !period) return ''
  let h = parseInt(hour)
  if (period === 'AM' && h === 12) h = 0
  if (period === 'PM' && h !== 12) h += 12
  return `${String(h).padStart(2,'0')}:${minute}`
}

function formatDisplay(hour, minute, period) {
  if (!hour || !minute || !period) return null
  return `${hour}:${minute} ${period}`
}

export default function TimePicker({ value, onChange, placeholder = 'Select', defaultPeriod = 'AM' }) {
  const parsed = parseValue(value)
  const [open,   setOpen]   = useState(false)
  const [hour,   setHour]   = useState(parsed.hour   || null)
  const [minute, setMinute] = useState(parsed.minute || null)
  const [period, setPeriod] = useState(parsed.period || defaultPeriod)
  const ref = useRef()

  // Sync if parent value changes externally
  useEffect(() => {
    const p = parseValue(value)
    if (p.hour)   setHour(p.hour)
    if (p.minute) setMinute(p.minute)
    if (p.period) setPeriod(p.period)
  }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(type, val) {
    let h = hour, m = minute, p = period
    if (type === 'hour')   h = val
    if (type === 'minute') m = val
    if (type === 'period') p = val
    setHour(h); setMinute(m); setPeriod(p)
    const result = toValue(h, m, p)
    if (result) { onChange(result); setOpen(false) }
  }

  function clear(e) {
    e.stopPropagation()
    setHour(null); setMinute(null); setPeriod(defaultPeriod)
    onChange('')
    setOpen(false)
  }

  const display = formatDisplay(hour, minute, period)

  return (
    <div className="tp-wrap" ref={ref}>
      <button type="button" className={`tp-btn ${open ? 'open' : ''} ${display ? 'has-value' : ''}`}
        onClick={() => setOpen(o => !o)}>
        <span className={display ? 'tp-val' : 'tp-placeholder'}>{display || placeholder}</span>
        <span className="tp-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="tp-popup">
          <div className="tp-col">
            <div className="tp-col-hdr">Hour</div>
            {HOURS.map(h => (
              <button key={h} type="button"
                className={`tp-item ${hour === h ? 'sel' : ''}`}
                onClick={() => select('hour', h)}>{h}</button>
            ))}
          </div>
          <div className="tp-col">
            <div className="tp-col-hdr">Min</div>
            {MINUTES.map(m => (
              <button key={m} type="button"
                className={`tp-item ${minute === m ? 'sel' : ''}`}
                onClick={() => select('minute', m)}>{m}</button>
            ))}
          </div>
          <div className="tp-col tp-col-period">
            <div className="tp-col-hdr">AM/PM</div>
            {PERIODS.map(p => (
              <button key={p} type="button"
                className={`tp-item ${period === p ? 'sel' : ''}`}
                onClick={() => select('period', p)}>{p}</button>
            ))}
          </div>
          {display && (
            <button type="button" className="tp-clear" onClick={clear}>✕</button>
          )}
        </div>
      )}
    </div>
  )
}
