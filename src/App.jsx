import { lazy, Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import UpdateBanner from './components/UpdateBanner'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import PrivacyPage from './pages/PrivacyPage'
import DirectoryPage from './pages/DirectoryPage'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AdminPage from './pages/AdminPage'
import PublicFinderPage from './pages/PublicFinderPage'

const MapPage = lazy(() => import('./pages/MapPage'))

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes

function RequireAuth({ children }) {
  const { session, isAdmin } = useAuth()
  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(true)

  useEffect(() => {
    if (!session) { setChecked(true); return }
    if (isAdmin) { setChecked(true); setAllowed(true); return }
    async function verify() {
      const uid = session.user.id
      const { data: pubAcct } = await supabase.from('public_accounts').select('id').eq('auth_user_id', uid).single()
      if (pubAcct) {
        const { data: locs } = await supabase.from('locations').select('id').eq('user_id', uid).limit(1)
        if (!locs || locs.length === 0) { setAllowed(false); setChecked(true); return }
      }
      setAllowed(true); setChecked(true)
    }
    verify()
  }, [session, isAdmin])

  if (!session) return <Navigate to="/" replace />
  if (!checked) return <div className="loading">Loading…</div>
  if (!allowed) return <Navigate to="/find" replace />
  return children
}

function InactivityRedirect() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const timer = useRef(null)

  const reset = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      // Only redirect if not a logged-in club owner / admin
      if (!session) {
        navigate('/', { replace: true })
      }
    }, INACTIVITY_MS)
  }, [navigate, session])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer.current)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [reset])

  return null
}

export default function App() {
  useEffect(() => {
    async function applyTheme() {
      const { data } = await supabase
        .from('app_settings')
        .select('theme_page_bg, theme_card_header_bg, theme_card_header_text, theme_card_header_bold, theme_card_body')
        .eq('id', 1)
        .single()
      if (!data) return
      const root = document.documentElement
      if (data.theme_page_bg)          root.style.setProperty('--theme-page-bg',          data.theme_page_bg)
      if (data.theme_card_header_bg)   root.style.setProperty('--theme-card-header-bg',   data.theme_card_header_bg)
      if (data.theme_card_header_text) root.style.setProperty('--theme-card-header-text', data.theme_card_header_text)
      root.style.setProperty('--theme-card-header-weight', data.theme_card_header_bold === false ? '400' : '600')
      if (data.theme_card_body)        root.style.setProperty('--theme-card-body',         data.theme_card_body)
    }
    applyTheme()
  }, [])

  return (
    <>
      <UpdateBanner />
      <InactivityRedirect />
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/find" element={<PublicFinderPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="map" replace />} />
        <Route path="map" element={
          <Suspense fallback={<div className="loading">Loading map…</div>}>
            <MapPage />
          </Suspense>
        } />
        <Route path="directory" element={<DirectoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
    </>
  )
}
