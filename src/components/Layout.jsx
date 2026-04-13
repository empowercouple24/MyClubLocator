import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import WelcomeModal from './WelcomeModal'

const ACCESS_KEYS = ['member_signups_enabled','member_login_enabled','public_search_enabled','public_accounts_enabled','public_login_enabled']

export default function Layout() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMapPage = location.pathname === '/app/map'
  const [anyPaused, setAnyPaused] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    async function checkAccess() {
      const { data } = await supabase.from('app_settings').select(ACCESS_KEYS.join(',')).eq('id', 1).single()
      if (data) setAnyPaused(ACCESS_KEYS.some(k => data[k] === false))
    }
    checkAccess()
  }, [isAdmin])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <WelcomeModal />

      <header className="topbar">
        <NavLink to="/app/map" className="brand" style={{ textDecoration: 'none' }}>My Club<span> Locator</span></NavLink>
        <nav className="topbar-nav">
          {isMapPage && <button
            className="btn-outline layout-public-search-btn"
            onClick={() => {
              const ext = sessionStorage.getItem('mapExtent')
              const params = new URLSearchParams({ owner: '1' })
              if (ext) {
                try {
                  const { lat, lng, zoom } = JSON.parse(ext)
                  params.set('lat', lat.toFixed(6))
                  params.set('lng', lng.toFixed(6))
                  params.set('zoom', zoom)
                } catch {}
              }
              navigate(`/find?${params.toString()}`)
            }}
            title="Switch to public club finder"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Public search
          </button>}
          <span className="topbar-user">{user?.email}</span>
          <button className="btn-outline" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      <nav className="tabbar">
        <NavLink to="/app/map"       className={({ isActive }) => isActive ? 'active' : ''}>Map</NavLink>
        <NavLink to="/app/directory" className={({ isActive }) => isActive ? 'active' : ''}>Directory</NavLink>
        <NavLink to="/app/profile"   className={({ isActive }) => isActive ? 'active' : ''}>My Profile</NavLink>
        {isAdmin && (
          <NavLink to="/app/admin" className={({ isActive }) => isActive ? 'active' : ''}>
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Admin
              {anyPaused && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#F59E0B', display: 'inline-block', flexShrink: 0,
                  animation: 'nav-dot-pulse 2s ease-in-out infinite'
                }} />
              )}
            </span>
          </NavLink>
        )}
      </nav>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
