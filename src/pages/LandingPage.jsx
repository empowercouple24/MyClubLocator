import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { geocodeAutocomplete } from '../lib/geocode'

function TargetIcon({ size = 26, color = '#4CAF82' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="3.5" fill={color}/><circle cx="9" cy="9" r="7" stroke={color} strokeWidth="1.5" fill="none"/>
      <line x1="9" y1="2" x2="9" y2="0.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="16" x2="9" y2="17.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="2" y1="9" x2="0.5" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="9" x2="17.5" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function GoogleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
}
function FacebookIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/></svg>
}

function NetworkDotsBg() {
  return (
    <div className="ld-bg">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="10" y1="20" x2="25" y2="35" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="25" y1="35" x2="45" y2="28" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="45" y1="28" x2="65" y2="42" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="65" y1="42" x2="85" y2="32" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="35" y1="55" x2="55" y2="48" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="55" y1="48" x2="75" y2="60" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="15" y1="65" x2="40" y2="55" stroke="rgba(76,175,130,0.04)" strokeWidth="0.3"/>
        <line x1="70" y1="72" x2="90" y2="58" stroke="rgba(76,175,130,0.03)" strokeWidth="0.3"/>
      </svg>
      {[[10,20],[25,35,1],[45,28],[65,42,1],[85,32],[35,55,1],[55,48],[75,60,1],[15,65],[40,22,1],[70,72],[90,58,1],[20,80],[50,70,1]].map(([x,y,g],i) => (
        <div key={i} className={`ld-dot${g ? ' glow' : ''}`} style={{ left: x+'%', top: y+'%' }} />
      ))}
    </div>
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
    setError(''); setLoading(true)
    const { error } = await supabase.from('contact_submissions').insert({ name, email, message })
    if (error) { setError('Something went wrong. Please try again.'); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  return (
    <div className="contact-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="contact-modal">
        <button className="contact-modal-close" onClick={onClose}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
        {sent ? (
          <div className="contact-success">
            <div className="contact-success-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#E1F5EE"/><path d="M7 12l3.5 3.5L17 8" stroke="#1A3C2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <h2 className="contact-success-title">Message sent!</h2>
            <p className="contact-success-sub">We'll get back to you as soon as we can.</p>
            <button className="landing-btn landing-btn--green" style={{ marginTop: '1.5rem' }} onClick={onClose}>Back to welcome page</button>
          </div>
        ) : (
          <>
            <h2 className="contact-modal-title">Get in touch</h2>
            <p className="contact-modal-sub">Have a question? Send us a message and we'll get back to you.</p>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="field"><label>Your name</label><input type="text" name="name" placeholder="First and last name" value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="field"><label>Email address</label><input type="email" name="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <div className="field"><label>Message</label><textarea className="contact-textarea" placeholder="What's on your mind?" value={message} onChange={e => setMessage(e.target.value)} required rows={4} /></div>
              <button className="btn-full" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send message'}</button>
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
  const [flipped, setFlipped] = useState(false)
  const [authTab, setAuthTab] = useState('signin')
  const [stats, setStats] = useState({ clubs: 0, cities: 0, states: 0 })

  // Auth form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [signupDone, setSignupDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHighlighted, setSearchHighlighted] = useState(-1)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchWrapRef = useRef(null)
  const userLocRef = useRef(null)

  // Get user location once for proximity bias
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { userLocRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
        () => {},
        { timeout: 5000, maximumAge: 300000 }
      )
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const doSearch = useCallback((() => {
    let timer
    return (q) => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        if (q.length < 3) { setSearchResults([]); setSearchOpen(false); return }
        setSearchLoading(true)
        const data = await geocodeAutocomplete(q, { types: 'place,postcode,address', limit: 6, proximity: userLocRef.current })
        setSearchResults(data)
        setSearchOpen(data.length > 0)
        setSearchHighlighted(-1)
        setSearchLoading(false)
      }, 350)
    }
  })(), [])

  function handleSearchInput(e) {
    const q = e.target.value
    setSearchQuery(q)
    doSearch(q)
  }

  function handleSearchSelect(result) {
    setSearchQuery(result.displayStreet || result.label?.split(',')[0] || '')
    setSearchOpen(false)
    setSearchResults([])
    navigate(`/find?lat=${result.lat}&lng=${result.lng}&zoom=13`)
  }

  function handleSearchKeyDown(e) {
    if (!searchOpen) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSearchHighlighted(h => Math.min(h + 1, searchResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && searchHighlighted >= 0) { e.preventDefault(); handleSearchSelect(searchResults[searchHighlighted]) }
    else if (e.key === 'Escape') { setSearchOpen(false) }
  }

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase.from('locations').select('city, state').not('lat', 'is', null).or('approved.eq.true,approved.is.null')
      if (data) {
        setStats({
          clubs: data.length,
          cities: new Set(data.map(l => l.city).filter(Boolean)).size,
          states: new Set(data.map(l => l.state).filter(Boolean)).size,
        })
      }
    }
    loadStats()
  }, [])

  function flipTo(tab) {
    setFlipped(true)
    setAuthTab(tab)
    setError('')
  }

  function flipBack() {
    setFlipped(false)
    setError('')
    setSignupDone(false)
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { navigate('/app/map') }
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (!termsAccepted) { setError('You must accept the Privacy & Use Policy.'); return }
    setError(''); setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/login?confirmed=1` }
    })
    if (error) { setError(error.message); setLoading(false) }
    else {
      if (data?.user?.id) {
        await supabase.from('notifications').insert({ type: 'new_signup', title: 'New member signed up', body: `${email} just created an account.`, user_id: data.user.id })
      }
      setLoading(false)
      setSignupDone(true)
    }
  }

  async function handleOAuth(provider) {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/app/map` } })
    if (error) setError(error.message)
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (searchHighlighted >= 0 && searchResults[searchHighlighted]) {
      handleSearchSelect(searchResults[searchHighlighted])
    } else if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0])
    } else if (searchQuery.trim()) {
      // Fallback: fire a one-shot search and navigate with the first result
      const data = await geocodeAutocomplete(searchQuery.trim(), { types: 'place,postcode,address', limit: 1, proximity: userLocRef.current })
      if (data.length > 0) {
        navigate(`/find?lat=${data[0].lat}&lng=${data[0].lng}&zoom=13`)
      } else {
        navigate('/find')
      }
    } else {
      navigate('/find')
    }
  }

  return (
    <div className="ld-page">
      <NetworkDotsBg />

      <div className="ld-content">
        {/* Header */}
        <div className="ld-header">
          <div className="ld-header-icon"><TargetIcon size={26} /></div>
          <div className="ld-header-brand">My<span>Club</span>Locator</div>
          <h1 className="ld-header-tagline">Find a nutrition club <em>near you</em></h1>
        </div>

        {/* Flipping card */}
        <div className="ld-card-scene">
          <div className={`ld-card-flipper ${flipped ? 'flipped' : ''}`}>

            {/* ═══ FRONT — Search ═══ */}
            <div className="ld-card-face ld-card-front">
              <form className="ld-search-body" onSubmit={handleSearch}>
                <h2 className="ld-search-title">Search Clubs</h2>
                <p className="ld-search-sub">Enter a ZIP code or city to find independently owned nutrition clubs near you.</p>
                <div className="ld-search-input-wrap" ref={searchWrapRef}>
                  <svg className="ld-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  <input className="ld-search-input" type="text" placeholder="ZIP code, city, or address…" value={searchQuery} onChange={handleSearchInput} onKeyDown={handleSearchKeyDown} onFocus={() => searchResults.length > 0 && setSearchOpen(true)} autoComplete="off" />
                  {searchLoading && <span className="ld-search-spinner">⟳</span>}
                  {searchOpen && searchResults.length > 0 && (
                    <ul className="ld-search-dropdown">
                      {searchResults.map((r, i) => (
                        <li
                          key={r.id}
                          className={`ld-search-dropdown-item${i === searchHighlighted ? ' highlighted' : ''}`}
                          onMouseDown={() => handleSearchSelect(r)}
                          onMouseEnter={() => setSearchHighlighted(i)}
                        >
                          <span className="ld-search-dropdown-main">📍 {r.displayStreet || r.label?.split(',')[0]}</span>
                          {r.displaySecondary && <span className="ld-search-dropdown-sub">{r.displaySecondary}</span>}
                        </li>
                      ))}
                      <li className="ld-search-dropdown-credit">Powered by Mapbox</li>
                    </ul>
                  )}
                </div>
                <button className="ld-search-btn" type="submit">Find a club near me →</button>
                <div className="ld-search-or">or</div>
                <button className="ld-locate-btn" type="button" onClick={() => navigate('/find?locate=1')}>
                  <TargetIcon size={16} /> Use my location
                </button>
              </form>

              <div className="ld-stats">
                <div className="ld-stats-cards">
                  <div className="ld-stat-card"><div className="ld-stat-num">{stats.clubs}</div><div className="ld-stat-label">Clubs</div></div>
                  <div className="ld-stat-card"><div className="ld-stat-num">{stats.cities}</div><div className="ld-stat-label">Cities</div></div>
                  <div className="ld-stat-card"><div className="ld-stat-num">{stats.states}</div><div className="ld-stat-label">States</div></div>
                </div>
                <div className="ld-stats-growl">…and our network is growing every day</div>
              </div>

              <div className="ld-owner-strip">
                Own a nutrition club?{' '}
                <a onClick={() => flipTo('signup')}>Sign up</a> to add your club or{' '}
                <a onClick={() => flipTo('signin')}>Log in</a> to manage your club
              </div>
            </div>

            {/* ═══ BACK — Auth ═══ */}
            <div className="ld-card-face ld-card-back">
              {signupDone ? (
                <div className="ld-check-email">
                  <div className="ld-check-email-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="#4CAF82" strokeWidth="1.5"/><path d="M2 7l10 7 10-7" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <h3 className="ld-check-email-title">Check your email</h3>
                  <p className="ld-check-email-sub">We sent a confirmation link to</p>
                  <p className="ld-check-email-addr">{email}</p>
                  <p className="ld-check-email-hint">Click the link to verify your account. Once confirmed, we'll walk you through setting up your club.</p>
                  <p className="ld-check-email-resend">
                    Didn't get the email? <a onClick={async () => { await supabase.auth.resend({ type: 'signup', email }); alert('Resent!') }}>Resend it</a>
                  </p>
                </div>
              ) : (
                <div className="ld-auth-body">
                  <div className="ld-auth-tabs">
                    <button className={`ld-auth-tab ${authTab === 'signin' ? 'active' : ''}`} onClick={() => { setAuthTab('signin'); setError('') }}>Sign In</button>
                    <button className={`ld-auth-tab ${authTab === 'signup' ? 'active' : ''}`} onClick={() => { setAuthTab('signup'); setError('') }}>Create Account</button>
                    <div className={`ld-auth-indicator ${authTab === 'signup' ? 'right' : ''}`} />
                  </div>

                  {error && <div className="error-msg" style={{ margin: '12px 28px 0' }}>{error}</div>}

                  {authTab === 'signin' && (
                    <form className="ld-auth-panel" onSubmit={handleSignIn}>
                      <label className="ld-auth-label">Email</label>
                      <input className="ld-auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                      <label className="ld-auth-label">Password</label>
                      <input className="ld-auth-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                      <div className="ld-auth-forgot"><a href="#" onClick={e => { e.preventDefault(); navigate('/forgot-password') }}>Forgot password?</a></div>
                      <button className="ld-auth-btn ld-auth-btn--forest" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
                      <div className="ld-auth-divider">or</div>
                      <div className="ld-oauth-row">
                        <button type="button" className="ld-oauth-btn" onClick={() => handleOAuth('google')}><GoogleIcon /> Google</button>
                        <button type="button" className="ld-oauth-btn" onClick={() => handleOAuth('facebook')}><FacebookIcon /> Facebook</button>
                      </div>
                    </form>
                  )}

                  {authTab === 'signup' && (
                    <form className="ld-auth-panel" onSubmit={handleSignUp}>
                      <label className="ld-auth-label">Email</label>
                      <input className="ld-auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                      <label className="ld-auth-label">Password</label>
                      <input className="ld-auth-input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                      <div className="ld-auth-terms">
                        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                        <span>I accept the <a href="/privacy" target="_blank" rel="noreferrer">Privacy & Use Policy</a></span>
                      </div>
                      <button className="ld-auth-btn ld-auth-btn--mint" type="submit" disabled={loading || !termsAccepted}>{loading ? 'Creating…' : 'Create my free account'}</button>
                      <div className="ld-auth-divider">or</div>
                      <div className="ld-oauth-row">
                        <button type="button" className="ld-oauth-btn" onClick={() => handleOAuth('google')}><GoogleIcon /> Google</button>
                        <button type="button" className="ld-oauth-btn" onClick={() => handleOAuth('facebook')}><FacebookIcon /> Facebook</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              <div className="ld-back-strip">
                <button className="ld-back-link" onClick={flipBack}>← Back to club search</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer pills */}
        <div className="ld-pills">
          <span className="ld-pill"><span className="ld-pill-dot" /> Get discovered on the map</span>
          <span className="ld-pill"><span className="ld-pill-dot" /> Connect with other owners</span>
          <span className="ld-pill"><span className="ld-pill-dot" /> Explore market data</span>
        </div>

        <div className="ld-footer">
          Questions? <a onClick={() => setShowContact(true)}>Send us a message</a> · <a href="/privacy">Privacy & Use Policy</a>
        </div>
      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
