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

const ADMIN_ID = 'ed1f34a7-7838-4d01-a29c-63220c43e9f1'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')

  // Welcome state — shown after successful login for returning users
  const [welcome, setWelcome] = useState(null) // null | { type, name, clubName, approved }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const user = authData.user
    const isAdmin = user.id === ADMIN_ID

    // Admin bypasses all checks
    if (isAdmin) { navigate('/app/map'); return }

    // Check member_login_enabled
    const { data: settings } = await supabase
      .from('app_settings').select('member_login_enabled, login_msg_approved_enabled, login_msg_approved, login_msg_pending_enabled, login_msg_pending, login_msg_no_profile_enabled, login_msg_no_profile').eq('id', 1).single()
    if (settings && settings.member_login_enabled === false) {
      await supabase.auth.signOut()
      setError('Access is temporarily unavailable. Please try again later.')
      setLoading(false)
      return
    }

    // Check onboarding status and profile for welcome message
    const { data: uta } = await supabase
      .from('user_terms_acceptance')
      .select('onboarding_done')
      .eq('user_id', user.id)
      .single()

    const { data: locs } = await supabase
      .from('locations')
      .select('first_name, club_name, approved')
      .eq('user_id', user.id)
      .order('created_at')

    const loc = locs?.[0] || null

    // Route based on state
    if (!uta?.onboarding_done) {
      navigate('/onboarding')
      return
    }

    // Replace {name}, {club}, {club_2}, {club_3} tokens
    const applyTokens = (template, name, club) =>
      (template || '')
        .replace(/\{name\}/g, name || '')
        .replace(/\{club\}/g, club || locs?.[0]?.club_name || '')
        .replace(/\{club_2\}/g, locs?.[1]?.club_name || '')
        .replace(/\{club_3\}/g, locs?.[2]?.club_name || '')
        .trim()

    if (!loc) {
      const msgEnabled = settings?.login_msg_no_profile_enabled !== false
      const msgText    = applyTokens(settings?.login_msg_no_profile, null, null) ||
        "Welcome back! Your club profile isn't set up yet. Finish setting it up to appear on the map."
      setWelcome({ type: 'no_profile', name: null, msg: msgEnabled ? msgText : null })
      setLoading(false)
      return
    }

    if (loc.approved === false) {
      const msgEnabled = settings?.login_msg_pending_enabled !== false
      const msgText    = applyTokens(settings?.login_msg_pending, loc.first_name, loc.club_name) ||
        `Welcome back${loc.first_name ? `, ${loc.first_name}` : ''}! ${loc.club_name || 'Your club'} is pending approval.`
      setWelcome({ type: 'pending', name: loc.first_name, clubName: loc.club_name, msg: msgEnabled ? msgText : null })
      setLoading(false)
      return
    }

    const msgEnabled = settings?.login_msg_approved_enabled !== false
    const msgText    = applyTokens(settings?.login_msg_approved, loc.first_name, loc.club_name) ||
      `Welcome back${loc.first_name ? `, ${loc.first_name}` : ''}! ${loc.club_name || 'Your club'} is live on the map.`
    setWelcome({ type: 'approved', name: loc.first_name, clubName: loc.club_name, msg: msgEnabled ? msgText : null })
    setLoading(false)
    setTimeout(() => navigate('/app/map'), 2200)
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

  // Welcome screen shown after login
  if (welcome) {
    return (
      <div className="auth-page">
        <div className="auth-card welcome-card">
          {welcome.type === 'approved' && (
            <>
              <div className="welcome-icon welcome-icon--green">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4CAF82"/>
                </svg>
              </div>
              {welcome.msg
                ? <p className="welcome-msg" style={{ marginBottom: '0.5rem' }}>{welcome.msg}</p>
                : <h1 className="welcome-title">Welcome back{welcome.name ? `, ${welcome.name}` : ''}!</h1>
              }
              <p className="welcome-sub">Taking you to the map…</p>
            </>
          )}
          {welcome.type === 'pending' && (
            <>
              <div className="welcome-icon welcome-icon--amber">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="1.5"/>
                  <path d="M12 7v6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="16.5" r="0.75" fill="#F59E0B"/>
                </svg>
              </div>
              {welcome.msg
                ? <p className="welcome-msg">{welcome.msg}</p>
                : <>
                    <h1 className="welcome-title">Welcome back{welcome.name ? `, ${welcome.name}` : ''}!</h1>
                    <p className="welcome-msg">{welcome.clubName || 'Your club'} is pending approval. You'll appear on the map once approved.</p>
                  </>
              }
              <button className="btn-full" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/app/map')}>
                Go to the map →
              </button>
            </>
          )}
          {welcome.type === 'no_profile' && (
            <>
              <div className="welcome-icon welcome-icon--blue">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#6B8DD6" strokeWidth="1.5"/>
                  <path d="M12 8v4l3 3" stroke="#6B8DD6" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              {welcome.msg
                ? <p className="welcome-msg">{welcome.msg}</p>
                : <>
                    <h1 className="welcome-title">Welcome back!</h1>
                    <p className="welcome-msg">Your club profile isn't set up yet. Finish setting it up to appear on the map.</p>
                  </>
              }
              <button className="btn-full" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/app/profile')}>
                Set up my club →
              </button>
              <button className="btn-text-link" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/app/map')}>
                Go to map first
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="sub">Log in to your My Club Locator account to manage your location.</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="input-wrap">
              <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
          <button className="btn-full" type="submit" disabled={loading || !!oauthLoading}>
            {loading ? 'Logging in…' : 'Log in with email'}
          </button>
          <div className="forgot-link">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        </form>

        <div className="oauth-divider"><span>or</span></div>

        <div className="oauth-btns">
          <button className="oauth-btn oauth-btn--google" onClick={() => handleOAuth('google')} disabled={!!oauthLoading}>
            <GoogleIcon />
            {oauthLoading === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>
          <button className="oauth-btn oauth-btn--facebook" onClick={() => handleOAuth('facebook')} disabled={!!oauthLoading}>
            <FacebookIcon />
            {oauthLoading === 'facebook' ? 'Redirecting…' : 'Continue with Facebook'}
          </button>
        </div>

        <div className="auth-toggle">
          No account? <Link to="/signup">Sign up free</Link>
        </div>
        <div className="auth-toggle" style={{ marginTop: '8px' }}>
          <Link to="/">← Back to welcome page</Link>
        </div>
      </div>
    </div>
  )
}
