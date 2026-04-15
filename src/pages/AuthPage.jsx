import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ADMIN_ID = 'ed1f34a7-7838-4d01-a29c-63220c43e9f1'
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  )
}

function GoogleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
}

function FacebookIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/></svg>
}

// ── Hero stats loader ──
function useHeroStats() {
  const [stats, setStats] = useState({ clubs: 0, cities: 0, states: 0, newThisMonth: 0, hoursPerWeek: 0, teams: 0 })
  const [latestClub, setLatestClub] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: locs } = await supabase.from('locations').select('city, state, created_at, hours_monday_open, hours_monday_close, hours_tuesday_open, hours_tuesday_close, hours_wednesday_open, hours_wednesday_close, hours_thursday_open, hours_thursday_close, hours_friday_open, hours_friday_close, hours_saturday_open, hours_saturday_close, hours_sunday_open, hours_sunday_close')
      const { count: teamCount } = await supabase.from('teams').select('id', { count: 'exact', head: true })
      const { data: latest } = await supabase.from('locations').select('club_name, city, state, created_at').order('created_at', { ascending: false }).limit(5)

      if (locs) {
        const cities = new Set(locs.map(l => l.city).filter(Boolean))
        const states = new Set(locs.map(l => l.state).filter(Boolean))
        const now = new Date()
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        const newThisMonth = locs.filter(l => new Date(l.created_at) >= monthAgo).length

        // Calculate total hours open per week
        let totalMinutes = 0
        locs.forEach(loc => {
          DAYS.forEach(d => {
            const open = loc[`hours_${d}_open`]
            const close = loc[`hours_${d}_close`]
            if (open && close) {
              const toMin = t => {
                const [time, period] = t.split(' ')
                let [h, m] = time.split(':').map(Number)
                if (period === 'PM' && h !== 12) h += 12
                if (period === 'AM' && h === 12) h = 0
                return h * 60 + (m || 0)
              }
              const diff = toMin(close) - toMin(open)
              if (diff > 0) totalMinutes += diff
            }
          })
        })

        setStats({
          clubs: locs.length,
          cities: cities.size,
          states: states.size,
          newThisMonth,
          hoursPerWeek: Math.round(totalMinutes / 60),
          teams: teamCount || 0,
        })
      }

      if (latest && latest.length > 0) setLatestClub(latest)
    }
    load()
  }, [])

  return { stats, latestClub }
}

function formatStat(n) {
  if (n >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Network dots for hero background ──
function NetworkDots() {
  const [activeNodes, setActiveNodes] = useState(new Set())
  const [activeLines, setActiveLines] = useState(new Set())

  const nodes = [[15,30],[30,45],[50,35],[70,50],[85,40],[40,60],[60,55],[75,65],[20,70],[45,25],[65,72],[25,55],[10,50],[80,30],[90,55],[55,72],[35,18],[78,22],[18,82],[62,82],[92,65],[8,35],[48,68],[72,15],[38,78]]
  const lines = [[0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[0,12],[12,11],[11,5],[8,11],[9,2],[10,7],[13,4],[13,3],[14,7],[14,10],[15,10],[15,6],[16,9],[16,2],[17,4],[17,13],[18,8],[18,11],[19,10],[19,15],[20,14],[20,7],[21,12],[21,0],[22,6],[22,15],[23,17],[23,13],[24,18],[24,8]]

  useEffect(() => {
    const id = setInterval(() => {
      const count = 3 + Math.floor(Math.random() * 4)
      const newNodes = new Set()
      for (let i = 0; i < count; i++) newNodes.add(Math.floor(Math.random() * nodes.length))
      setActiveNodes(newNodes)
      const newLines = new Set()
      lines.forEach(([a, b], li) => { if (newNodes.has(a) || newNodes.has(b)) newLines.add(li) })
      setActiveLines(newLines)
    }, 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="auth-map-bg">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map(([a, b], i) => (
          <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
            stroke={activeLines.has(i) ? 'rgba(76,175,130,0.25)' : 'rgba(76,175,130,0.06)'}
            strokeWidth={activeLines.has(i) ? '0.4' : '0.3'}
            style={{ transition: 'stroke 1.2s ease, stroke-width 1.2s ease' }}
          />
        ))}
      </svg>
      {nodes.map(([x, y], i) => (
        <div key={i} className={`auth-bg-dot ${activeNodes.has(i) ? 'auth-bg-dot--electric' : ''}`} style={{ left: x+'%', top: y+'%' }} />
      ))}
    </div>
  )
}

// ══════════════════════════════════════════
// Main AuthPage — unified login + signup
// ══════════════════════════════════════════
export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSignupRoute = location.pathname === '/signup'
  const searchParams = new URLSearchParams(location.search)
  const isEmailConfirmed = searchParams.get('confirmed') === '1'

  const [tab, setTab] = useState(isSignupRoute ? 'signup' : 'signin')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(true)

  // Signup enabled check
  const [signupsEnabled, setSignupsEnabled] = useState(true)
  const [checkingSettings, setCheckingSettings] = useState(true)

  // Welcome state (post-login)
  const [welcome, setWelcome] = useState(null)

  // Email confirmed welcome state
  const [emailJustConfirmed, setEmailJustConfirmed] = useState(false)

  // New user welcome screen settings
  const [welcomeNewSettings, setWelcomeNewSettings] = useState(null)

  // Detect email confirmation redirect — Supabase auto-signs in via URL tokens
  useEffect(() => {
    if (!isEmailConfirmed) return
    async function handleConfirmed() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: existing } = await supabase.from('user_terms_acceptance').select('id').eq('user_id', session.user.id).single()
        if (!existing) {
          await supabase.from('user_terms_acceptance').insert({ user_id: session.user.id })
        }
        // Load welcome screen settings
        const { data: ws } = await supabase.from('app_settings')
          .select('welcome_new_title, welcome_new_message, welcome_new_video_enabled, welcome_new_video_url, welcome_new_button_text')
          .eq('id', 1).single()
        if (ws) setWelcomeNewSettings(ws)
        setEmailJustConfirmed(true)
      }
    }
    setTimeout(handleConfirmed, 500)
  }, [isEmailConfirmed])

  // Hero data
  const { stats, latestClub } = useHeroStats()
  const [tickerIdx, setTickerIdx] = useState(0)
  const tickerRef = useRef(null)

  // Rotating ticker
  useEffect(() => {
    if (!latestClub || latestClub.length === 0) return
    const interval = setInterval(() => {
      setTickerIdx(i => (i + 1) % latestClub.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [latestClub])

  // Check signups enabled
  useEffect(() => {
    async function check() {
      const { data } = await supabase.from('app_settings').select('member_signups_enabled').eq('id', 1).single()
      if (data && data.member_signups_enabled === false) setSignupsEnabled(false)
      setCheckingSettings(false)
    }
    check()
  }, [])

  // Clear error on tab switch
  useEffect(() => { setError('') }, [tab])

  function switchTab(t) {
    if (t === tab) return
    setTab(t)
    setError('')
  }

  // ── Sign In handler ──
  async function handleSignIn(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }

    const user = authData.user
    if (user.id === ADMIN_ID) { navigate('/app/map'); return }

    // Block public-only accounts from owner portal
    const { data: pubAcct } = await supabase.from('public_accounts').select('id').eq('auth_user_id', user.id).single()
    if (pubAcct) {
      const { data: ownerLoc } = await supabase.from('locations').select('id').eq('user_id', user.id).limit(1)
      if (!ownerLoc || ownerLoc.length === 0) {
        await supabase.auth.signOut()
        setError('This account is registered for club search only. Use the Find page to sign in, or create a club owner account.')
        setLoading(false); return
      }
    }

    const { data: settings } = await supabase
      .from('app_settings').select('member_login_enabled, login_msg_approved_enabled, login_msg_approved, login_msg_pending_enabled, login_msg_pending, login_msg_no_profile_enabled, login_msg_no_profile').eq('id', 1).single()
    if (settings && settings.member_login_enabled === false) {
      await supabase.auth.signOut()
      setError('Access is temporarily unavailable. Please try again later.')
      setLoading(false); return
    }

    let { data: uta } = await supabase.from('user_terms_acceptance').select('onboarding_done').eq('user_id', user.id).single()
    // Safety net: if row doesn't exist yet (e.g. confirmed on different device), create it
    if (!uta) {
      await supabase.from('user_terms_acceptance').insert({ user_id: user.id })
      uta = { onboarding_done: false }
    }
    const { data: locs } = await supabase.from('locations').select('first_name, club_name, approved').eq('user_id', user.id).order('created_at')
    const loc = locs?.[0] || null

    if (!uta.onboarding_done) { navigate('/onboarding'); return }

    const applyTokens = (template, name, club) =>
      (template || '').replace(/\{name\}/g, name || '').replace(/\{club\}/g, club || locs?.[0]?.club_name || '')
        .replace(/\{club_2\}/g, locs?.[1]?.club_name || '').replace(/\{club_3\}/g, locs?.[2]?.club_name || '').trim()

    if (!loc) {
      const msg = settings?.login_msg_no_profile_enabled !== false
        ? (applyTokens(settings?.login_msg_no_profile) || "Welcome back! Your club profile isn't set up yet.")
        : null
      setWelcome({ type: 'no_profile', msg }); setLoading(false); return
    }

    if (loc.approved === false) {
      const msg = settings?.login_msg_pending_enabled !== false
        ? (applyTokens(settings?.login_msg_pending, loc.first_name, loc.club_name) || `Welcome back! ${loc.club_name || 'Your club'} is pending approval.`)
        : null
      setWelcome({ type: 'pending', name: loc.first_name, clubName: loc.club_name, msg }); setLoading(false); return
    }

    const msg = settings?.login_msg_approved_enabled !== false
      ? (applyTokens(settings?.login_msg_approved, loc.first_name, loc.club_name) || `Welcome back${loc.first_name ? `, ${loc.first_name}` : ''}!`)
      : null
    setWelcome({ type: 'approved', name: loc.first_name, clubName: loc.club_name, msg }); setLoading(false)
    setTimeout(() => navigate('/app/map'), 2200)
  }

  // Post-signup confirmation state
  const [signupDone, setSignupDone] = useState(false)

  // ── Sign Up handler ──
  async function handleSignUp(e) {
    e.preventDefault()
    if (!termsAccepted) { setError('You must accept the Privacy & Use Policy to continue.'); return }
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
    setError(''); setOauthLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/app/map` } })
    if (error) { setError(error.message); setOauthLoading('') }
  }

  // ── Welcome screen (post-login) ──
  if (welcome) {
    return (
      <div className="auth-page-v2">
        <div className="auth-hero">
          <NetworkDots />
          <div className="auth-hero-content">
            <div className="auth-hero-icon">
              <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="auth-hero-divider" />
        </div>
        <div className="auth-form-zone">
          <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            {welcome.type === 'approved' && <>
              <div className="welcome-icon welcome-icon--green"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4CAF82"/></svg></div>
              {welcome.msg ? <p className="welcome-msg">{welcome.msg}</p> : <h2 style={{ fontSize: 20, marginBottom: 4 }}>Welcome back{welcome.name ? `, ${welcome.name}` : ''}!</h2>}
              <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Taking you to the map…</p>
            </>}
            {welcome.type === 'pending' && <>
              <div className="welcome-icon welcome-icon--amber"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="1.5"/><path d="M12 7v6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="16.5" r="0.75" fill="#F59E0B"/></svg></div>
              {welcome.msg ? <p className="welcome-msg">{welcome.msg}</p> : <p className="welcome-msg">{welcome.clubName || 'Your club'} is pending approval.</p>}
              <button className="auth-btn auth-btn--forest" style={{ marginTop: 16 }} onClick={() => navigate('/app/map')}>Go to the map →</button>
            </>}
            {welcome.type === 'no_profile' && <>
              <div className="welcome-icon welcome-icon--blue"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#6B8DD6" strokeWidth="1.5"/><path d="M12 8v4l3 3" stroke="#6B8DD6" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
              {welcome.msg ? <p className="welcome-msg">{welcome.msg}</p> : <p className="welcome-msg">Your club profile isn't set up yet.</p>}
              <button className="auth-btn auth-btn--forest" style={{ marginTop: 16 }} onClick={() => navigate('/app/profile')}>Set up my club →</button>
              <button className="auth-text-link" style={{ marginTop: 10 }} onClick={() => navigate('/app/map')}>Go to map first</button>
            </>}
          </div>
        </div>
      </div>
    )
  }

  // ── Email just confirmed — welcome + auto-redirect to onboarding ──
  if (emailJustConfirmed) {
    const ws = welcomeNewSettings || {}
    const title = ws.welcome_new_title || 'Welcome to My Club Locator!'
    const message = ws.welcome_new_message || 'Your email is confirmed and your account is active.'
    const btnText = ws.welcome_new_button_text || "Let's get started →"
    const showVideo = ws.welcome_new_video_enabled && ws.welcome_new_video_url

    return (
      <div className="auth-page-v2">
        <div className="auth-hero">
          <NetworkDots />
          <div className="auth-hero-content">
            <div className="auth-hero-icon">
              <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="auth-hero-divider" />
        </div>
        <div className="auth-form-zone">
          <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: '#E8F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#4CAF82" strokeWidth="1.5"/>
                <path d="M8 12l3 3 5-5" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C2E', marginBottom: 8 }}>{title}</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: showVideo ? 16 : 20 }}>
              {message}
            </p>
            {showVideo && (
              <div style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid #e8ede8' }}>
                <iframe
                  src={ws.welcome_new_video_url}
                  title="Welcome video"
                  style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <button className="auth-btn auth-btn--forest" onClick={() => navigate('/onboarding')}>
              {btnText}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Check your email screen (post-signup) ──
  if (signupDone) {
    return (
      <div className="auth-page-v2">
        <div className="auth-hero">
          <NetworkDots />
          <div className="auth-hero-content">
            <div className="auth-hero-icon">
              <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="auth-hero-divider" />
        </div>
        <div className="auth-form-zone">
          <div className="auth-card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: '#E8F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="#4CAF82" strokeWidth="1.5"/>
                <path d="M2 7l10 7 10-7" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A3C2E', marginBottom: 8 }}>Check your email</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 6 }}>
              We sent a confirmation link to
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A3C2E', marginBottom: 16 }}>{email}</p>
            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.5, marginBottom: 24 }}>
              Click the link in your email to verify your account. Once confirmed, we'll walk you through a quick onboarding to get your club on the map.
            </p>
            <p style={{ fontSize: 12, color: '#bbb', marginTop: 16 }}>
              Didn't get the email? Check your spam folder or <a style={{ color: '#4CAF82', cursor: 'pointer', textDecoration: 'none', fontWeight: 600 }} onClick={async () => {
                await supabase.auth.resend({ type: 'signup', email })
                setError('')
                alert('Confirmation email resent! Check your inbox.')
              }}>resend it</a>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (checkingSettings) return <div className="loading">Loading…</div>

  const currentTicker = latestClub?.[tickerIdx]

  return (
    <div className="auth-page-v2">
      {/* ═══ Hero ═══ */}
      <div className="auth-hero">
        <NetworkDots />
        <div className="auth-hero-content">
          <div className="auth-hero-icon">
            <svg width="26" height="26" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#4CAF82"/><circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <h1 className="auth-hero-title">My<span>Club</span>Locator</h1>
          <p className="auth-hero-sub">The community-powered map where Nutrition Club owners get discovered, connect, and grow.</p>

          <div className="auth-stats-grid">
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.clubs)}</div><div className="auth-stat-label">Clubs</div></div>
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.cities)}</div><div className="auth-stat-label">Cities</div></div>
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.states)}</div><div className="auth-stat-label">States</div></div>
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.newThisMonth)}</div><div className="auth-stat-label">New this mo.</div></div>
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.hoursPerWeek)}</div><div className="auth-stat-label">Hrs / week</div></div>
            <div className="auth-stat-chip"><div className="auth-stat-num">{formatStat(stats.teams)}</div><div className="auth-stat-label">Teams</div></div>
          </div>

          {currentTicker && (
            <div className="auth-live-bar">
              <div className="auth-live-dot"><div className="auth-live-ping" /></div>
              <div className="auth-live-text" key={tickerIdx}>
                <strong>{currentTicker.club_name || 'A new club'}</strong> joined from {currentTicker.city || 'unknown'}{currentTicker.state ? `, ${currentTicker.state}` : ''}
              </div>
              <span className="auth-live-time">{timeAgo(currentTicker.created_at)}</span>
            </div>
          )}
        </div>
        <div className="auth-hero-divider" />
      </div>

      {/* ═══ Tabbed form card ═══ */}
      <div className="auth-form-zone">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => switchTab('signin')}>Sign In</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>Create Account</button>
            <div className={`auth-tab-indicator ${tab === 'signup' ? 'right' : ''}`} />
          </div>

          {/* Sign In panel */}
          {tab === 'signin' && (
            <div className="auth-panel auth-slide-in">
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={handleSignIn}>
                <div className="field"><label>Email</label><input type="email" name="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
                <div className="field"><label>Password</label>
                  <div className="input-wrap">
                    <input type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)}><EyeIcon open={showPassword} /></button>
                  </div>
                </div>
                <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
                <button className="auth-btn auth-btn--forest" type="submit" disabled={loading || !!oauthLoading}>{loading ? 'Signing in…' : 'Sign in'}</button>
              </form>
              <div className="auth-divider"><span>or</span></div>
              <div className="auth-oauth-row">
                <button className="auth-oauth-btn" onClick={() => handleOAuth('google')} disabled={!!oauthLoading}><GoogleIcon /> Google</button>
                <button className="auth-oauth-btn" onClick={() => handleOAuth('facebook')} disabled={!!oauthLoading}><FacebookIcon /> Facebook</button>
              </div>
              <div className="auth-switch">New here? <a onClick={() => switchTab('signup')}>Create an account</a></div>
              <div className="auth-back"><Link to="/">← Back to welcome page</Link></div>
            </div>
          )}

          {/* Sign Up panel */}
          {tab === 'signup' && (
            <div className="auth-panel auth-slide-in">
              {!signupsEnabled ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Registration is currently closed</h3>
                  <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>New member signups are temporarily paused. Please check back soon or contact your upline for access.</p>
                </div>
              ) : (
                <>
                  {error && <div className="error-msg">{error}</div>}
                  <form onSubmit={handleSignUp}>
                    <div className="field"><label>Email</label><input type="email" name="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
                    <div className="field"><label>Password</label>
                      <div className="input-wrap">
                        <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                        <button type="button" className="eye-btn" onClick={() => setShowPassword(v => !v)}><EyeIcon open={showPassword} /></button>
                      </div>
                    </div>
                    <div className="auth-terms-row">
                      <input type="checkbox" id="terms-accept" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                      <label htmlFor="terms-accept">I accept the <Link to="/privacy" target="_blank" rel="noreferrer">Privacy & Use Policy</Link></label>
                    </div>
                    <button className="auth-btn auth-btn--mint" type="submit" disabled={loading || !!oauthLoading || !termsAccepted}>{loading ? 'Creating account…' : 'Create my free account'}</button>
                  </form>
                  <div className="auth-divider"><span>or</span></div>
                  <div className="auth-oauth-row">
                    <button className="auth-oauth-btn" onClick={() => handleOAuth('google')} disabled={!!oauthLoading}><GoogleIcon /> Google</button>
                    <button className="auth-oauth-btn" onClick={() => handleOAuth('facebook')} disabled={!!oauthLoading}><FacebookIcon /> Facebook</button>
                  </div>
                </>
              )}
              <div className="auth-switch">Already registered? <a onClick={() => switchTab('signin')}>Sign in</a></div>
              <div className="auth-back"><Link to="/">← Back to welcome page</Link></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
