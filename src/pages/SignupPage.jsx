import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#4F46E5" opacity="0.15"/>
      <path d="M5 8l2 2 4-4" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [signupsEnabled, setSignupsEnabled] = useState(true)
  const [checkingSettings, setCheckingSettings] = useState(true)

  useEffect(() => {
    async function checkSettings() {
      const { data } = await supabase
        .from('app_settings').select('member_signups_enabled').eq('id', 1).single()
      if (data && data.member_signups_enabled === false) setSignupsEnabled(false)
      setCheckingSettings(false)
    }
    checkSettings()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!termsAccepted) { setError('You must accept the Privacy & Use Policy to continue.'); return }
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else {
      if (data?.user?.id) {
        await supabase.from('user_terms_acceptance').insert({ user_id: data.user.id })
        await supabase.from('notifications').insert({
          type: 'new_signup',
          title: 'New member signed up',
          body: `${email} just created an account.`,
          user_id: data.user.id,
        })
      }
      navigate('/onboarding')
    }
  }

  async function handleOAuth(provider) {
    setError('')
    setOauthLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app/map` },
    })
    if (error) { setError(error.message); setOauthLoading('') }
  }

  if (checkingSettings) return <div className="loading">Loading…</div>

  return (
    <div className="auth-page auth-page--signup">
      <div className="signup-layout">

        {/* Left panel — value prop */}
        <div className="signup-panel signup-panel--left">
          <div className="signup-brand">
            <div className="signup-brand-pin">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#fff"/><circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span>My<span style={{color:'#4CAF82'}}>Club</span>Locator</span>
          </div>
          <h2 className="signup-panel-headline">Join the network of nutrition club owners</h2>
          <p className="signup-panel-sub">Register your club and connect with independent operators across the country.</p>
          <ul className="signup-panel-perks">
            <li><CheckIcon /><span>Get your club on the interactive map</span></li>
            <li><CheckIcon /><span>Explore market data and club density</span></li>
            <li><CheckIcon /><span>Connect with your upline network</span></li>
            <li><CheckIcon /><span>Manage hours, photos, and your story</span></li>
            <li><CheckIcon /><span>Free — always</span></li>
          </ul>
        </div>

        {/* Right panel — form or closed message */}
        <div className="signup-panel signup-panel--right">
          <div className="signup-form-wrap">

            {!signupsEnabled ? (
              <div className="signup-closed">
                <div className="signup-closed-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#B45309" strokeWidth="1.5"/>
                    <path d="M12 7v6" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="16.5" r="0.75" fill="#B45309"/>
                  </svg>
                </div>
                <h1 className="signup-closed-title">Registration is currently closed</h1>
                <p className="signup-closed-msg">New member signups are temporarily paused. Please check back soon or contact your upline for access.</p>
                <div className="auth-toggle" style={{ marginTop: '1.5rem' }}>
                  Already registered? <Link to="/login">Log in instead</Link>
                </div>
                <div className="auth-toggle" style={{ marginTop: '8px' }}>
                  <Link to="/">← Back to welcome page</Link>
                </div>
              </div>
            ) : (
              <>
                <h1 className="signup-form-title">Create your account</h1>
                <p className="signup-form-sub">It only takes a minute to get on the map.</p>

                {error && <div className="error-msg">{error}</div>}

                <div className="oauth-btns">
                  <button className="oauth-btn oauth-btn--google" onClick={() => handleOAuth('google')} disabled={!!oauthLoading}>
                    <GoogleIcon />
                    {oauthLoading === 'google' ? 'Redirecting…' : 'Sign up with Google'}
                  </button>
                  <button className="oauth-btn oauth-btn--facebook" onClick={() => handleOAuth('facebook')} disabled={!!oauthLoading}>
                    <FacebookIcon />
                    {oauthLoading === 'facebook' ? 'Redirecting…' : 'Sign up with Facebook'}
                  </button>
                </div>

                <div className="oauth-divider"><span>or sign up with email</span></div>

                <form onSubmit={handleSubmit}>
                  <div className="field">
                    <label>Email address</label>
                    <input type="email" name="email" id="signup-email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                  </div>
                  <div className="field">
                    <label>Password</label>
                    <div className="input-wrap">
                      <input type={showPassword ? 'text' : 'password'} name="password" id="signup-password" placeholder="Create a password (min. 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                      <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>
                  <div className="signup-terms-row">
                    <input
                      type="checkbox"
                      id="terms-accept"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      className="signup-terms-checkbox"
                    />
                    <label htmlFor="terms-accept" className="signup-terms-label">
                      I accept the terms of the{' '}
                      <Link to="/privacy" target="_blank" rel="noreferrer" className="signup-terms-link">
                        Privacy & Use Policy
                      </Link>
                    </label>
                  </div>
                  <button className="btn-full btn-full--indigo" type="submit" disabled={loading || !!oauthLoading || !termsAccepted}>
                    {loading ? 'Creating account…' : 'Create my free account'}
                  </button>
                </form>

                <div className="auth-toggle" style={{ marginTop: '1.25rem' }}>
                  Already registered? <Link to="/login">Log in instead</Link>
                </div>
                <div className="auth-toggle" style={{ marginTop: '8px' }}>
                  <Link to="/">← Back to welcome page</Link>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
