import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
    </svg>
  )
}

function ContactModal({ onClose }) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, message })
    if (error) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="contact-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="contact-modal">
        <button className="contact-modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {sent ? (
          <div className="contact-success">
            <div className="contact-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#E1F5EE"/>
                <path d="M7 12l3.5 3.5L17 8" stroke="#1A3C2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="contact-success-title">Message sent!</h2>
            <p className="contact-success-sub">We'll get back to you as soon as we can.</p>
            <button className="landing-btn landing-btn--green" style={{ marginTop: '1.5rem' }} onClick={onClose}>
              Back to welcome page
            </button>
          </div>
        ) : (
          <>
            <h2 className="contact-modal-title">Get in touch</h2>
            <p className="contact-modal-sub">Have a question? Send us a message and we'll get back to you.</p>

            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="field">
                <label>Your name</label>
                <input type="text" name="name" id="contact-name" placeholder="First and last name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Email address</label>
                <input type="email" name="email" id="contact-email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label>Message</label>
                <textarea
                  className="contact-textarea"
                  placeholder="What's on your mind?"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={4}
                />
              </div>
              <button className="btn-full" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// Eyebrow color → readable text/sub colors
const EYEBROW_TEXT = {
  '#F1EFE8': { label: '#aaa89e', sub: '#5F5E5A' },
  '#FAF8F4': { label: '#a89880', sub: '#6b5c48' },
  '#1A3C2E': { label: 'rgba(255,255,255,0.5)', sub: 'rgba(255,255,255,0.9)' },
  '#E1F5EE': { label: '#5a9e80', sub: '#0F6E56' },
  '#2C2C2A': { label: 'rgba(255,255,255,0.4)', sub: 'rgba(255,255,255,0.85)' },
  '#0C447C': { label: 'rgba(255,255,255,0.45)', sub: 'rgba(255,255,255,0.9)' },
  '#FAEEDA': { label: '#c49030', sub: '#854F0B' },
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [showContact, setShowContact] = useState(false)
  const [clubCount, setClubCount]     = useState(null)
  const [eyebrowColor, setEyebrowColor] = useState('#F1EFE8')
  const [panelColor, setPanelColor]     = useState('#1A3C2E')

  useEffect(() => {
    async function loadAppearance() {
      const { data } = await supabase
        .from('app_settings').select('landing_eyebrow_color, landing_hero_panel_color').eq('id', 1).single()
      if (data) {
        if (data.landing_eyebrow_color)    setEyebrowColor(data.landing_eyebrow_color)
        if (data.landing_hero_panel_color) setPanelColor(data.landing_hero_panel_color)
      }
    }
    async function loadCount() {
      const { count } = await supabase
        .from('locations').select('id', { count: 'exact', head: true })
        .not('lat', 'is', null).neq('approved', false)
      if (count != null) setClubCount(count)
    }
    loadAppearance()
    loadCount()
  }, [])

  const textColors = EYEBROW_TEXT[eyebrowColor] || EYEBROW_TEXT['#F1EFE8']
  // Derive border color: slightly darker than eyebrow bg
  const isDarkEyebrow = ['#1A3C2E','#2C2C2A','#0C447C'].includes(eyebrowColor)

  return (
    <div className="landing-page">
      <div className="landing-inner landing-inner--wide">

        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-pin"><PinIcon /></div>
          <span className="landing-logo-text">My Club Locator</span>
        </div>

        {/* Headline */}
        <h1 className="landing-headline">Welcome to My Club Locator</h1>
        <p className="landing-sub">
          The private locator for independently owned<br/>
          <span className="landing-sub-highlight">nutrition clubs</span>
        </p>

        {/* Hero card */}
        <div className="landing-hero-card">

          {/* Left: find-a-club content */}
          <div className="landing-hero-left">
            <span className="landing-badge landing-badge--public">Find a club</span>
            <h2 className="landing-hero-title">Looking for a nutrition club?</h2>
            <p className="landing-hero-desc">
              Search independently owned nutrition clubs near you. See hours, location, and owner info. No account required.
            </p>
            <ul className="landing-perks" style={{ marginBottom: '1.75rem' }}>
              <li><span className="landing-perk-dot landing-perk-dot--teal"></span>Search by address or zip code</li>
              <li><span className="landing-perk-dot landing-perk-dot--teal"></span>See today's hours at a glance</li>
              <li><span className="landing-perk-dot landing-perk-dot--teal"></span>No account required</li>
            </ul>
            <button className="landing-btn landing-btn--teal landing-hero-cta" onClick={() => navigate('/find')}>
              Find a club near me →
            </button>
          </div>

          {/* Right: decorative panel */}
          <div className="landing-hero-panel" style={{ background: panelColor }}>
            <div className="landing-panel-dots">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={`landing-panel-dot ${i === 1 || i === 4 || i === 10 ? 'big' : i === 6 || i === 12 ? 'gold' : ''}`} />
              ))}
            </div>
            <div className="landing-panel-count">
              <span className="landing-panel-number">{clubCount != null ? `${clubCount}` : '—'}</span>
              <span className="landing-panel-label">clubs on the map</span>
            </div>
          </div>

          {/* Bottom: eyebrow strip */}
          <div className="landing-eyebrow-strip">
            {/* Left eyebrow label */}
            <div
              className="landing-eyebrow-label"
              style={{
                background: eyebrowColor,
                borderRight: `0.5px solid ${isDarkEyebrow ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <span className="landing-eyebrow-title" style={{ color: textColors.label }}>Club owners</span>
              <span className="landing-eyebrow-sub" style={{ color: textColors.sub }}>Add &amp; manage →</span>
            </div>

            {/* Returning member */}
            <button className="landing-strip-cell" onClick={() => navigate('/login')}>
              <div className="landing-strip-icon landing-strip-icon--ret">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M15 3h6v6M10 14L21 3M9 7H3v14h14v-6" stroke="#0F6E56" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="landing-strip-text">
                <span className="landing-strip-main">Log in to manage my club</span>
                <span className="landing-strip-sub">Returning member</span>
              </div>
              <span className="landing-strip-arr">›</span>
            </button>

            {/* New member */}
            <button className="landing-strip-cell" onClick={() => navigate('/signup')}>
              <div className="landing-strip-icon landing-strip-icon--new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#4338CA" strokeWidth="1.7"/>
                  <path d="M12 8v8M8 12h8" stroke="#4338CA" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="landing-strip-text">
                <span className="landing-strip-main">Add my club to the map</span>
                <span className="landing-strip-sub">New member</span>
              </div>
              <span className="landing-strip-arr">›</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <p className="landing-footer">
          Questions?{' '}
          <button className="landing-contact-link" onClick={() => setShowContact(true)}>
            Send us a message
          </button>
          {' '}·{' '}
          <a href="/privacy" className="landing-contact-link" style={{ textDecoration: 'underline' }}>
            Privacy &amp; Use Policy
          </a>
        </p>

      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}

