import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import PrivacyPage from './pages/PrivacyPage'
import DirectoryPage from './pages/DirectoryPage'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AdminPage from './pages/AdminPage'
import PublicFinderPage from './pages/PublicFinderPage'

const MapPage = lazy(() => import('./pages/MapPage'))

function RequireAuth({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/" replace />
  return children
}

export default function App() {
  useEffect(() => {
    async function applyTheme() {
      const { data } = await supabase
        .from('app_settings')
        .select('theme_page_bg, theme_card_header_bg, theme_card_header_text, theme_card_body')
        .eq('id', 1)
        .single()
      if (!data) return
      const root = document.documentElement
      if (data.theme_page_bg)          root.style.setProperty('--theme-page-bg',          data.theme_page_bg)
      if (data.theme_card_header_bg)   root.style.setProperty('--theme-card-header-bg',   data.theme_card_header_bg)
      if (data.theme_card_header_text) root.style.setProperty('--theme-card-header-text', data.theme_card_header_text)
      if (data.theme_card_body)        root.style.setProperty('--theme-card-body',         data.theme_card_body)
    }
    applyTheme()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/signup" element={<SignupPage />} />
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
  )
}
