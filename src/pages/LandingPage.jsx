import { useState } from 'react'
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
                <input type="text" placeholder="First and last name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Email address</label>
                <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
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

export default function LandingPage() {
  const navigate = useNavigate()
  const [showContact, setShowContact] = useState(false)

  return (
    <div className="landing-page">
      <div className="landing-inner">

        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-pin"><PinIcon /></div>
          <span className="landing-logo-text">My Club Locator</span>
        </div>

        {/* Headline */}
        <h1 className="landing-headline">Welcome to My Club Locator</h1>
        <p className="landing-sub">
          The private locator for independently owned nutrition clubs.
          Find clubs, explore markets, and manage your location.
        </p>

        {/* Cards */}
        <div className="landing-cards">
          <div className="landing-card landing-card--returning">
            <span className="landing-badge landing-badge--returning">Returning member</span>
            <h2 className="landing-card-title">Good to have you back</h2>
            <p className="landing-card-desc">
              Your club is on the map. Log in to update your hours, photos, and club details.
            </p>
            <ul className="landing-perks">
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>Manage your club profile</li>
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>View market data near you</li>
              <li><span className="landing-perk-dot landing-perk-dot--green"></span>Browse the full directory</li>
            </ul>
            <button className="landing-btn landing-btn--green" onClick={() => navigate('/login')}>
              Log in to my account
            </button>
          </div>

          <div className="landing-card landing-card--new">
            <span className="landing-badge landing-badge--new">New member</span>
            <h2 className="landing-card-title">Put your club on the map</h2>
            <p className="landing-card-desc">
              Join the network, add your location, and connect with club owners across the country.
            </p>
            <ul className="landing-perks">
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Get discovered by your network</li>
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Explore nearby club density</li>
              <li><span className="landing-perk-dot landing-perk-dot--indigo"></span>Free — takes under a minute</li>
            </ul>
            <button className="landing-btn landing-btn--indigo" onClick={() => navigate('/signup')}>
              Create my free account
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="landing-footer">
          Questions? Contact us here:{' '}
          <button className="landing-contact-link" onClick={() => setShowContact(true)}>
            Send us a message
          </button>
        </p>

      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
