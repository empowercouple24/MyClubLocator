import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import WelcomeModal from './WelcomeModal'
import UpdateBanner from './UpdateBanner'

const ACCESS_KEYS = ['member_signups_enabled','member_login_enabled','public_search_enabled','public_accounts_enabled','public_login_enabled']

export default function Layout() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
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
      <UpdateBanner />
      <WelcomeModal />

      <header className="topbar">
        <NavLink to="/app/map" className="brand" style={{ textDecoration: 'none' }}>My Club<span> Locator</span></NavLink>
        <nav className="topbar-nav">
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
