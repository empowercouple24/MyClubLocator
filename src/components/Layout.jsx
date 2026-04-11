import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import WelcomeModal from './WelcomeModal'
import UpdateBanner from './UpdateBanner'

export default function Layout() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

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
          {isAdmin && (
            <NavLink to="/app/admin" className={({ isActive }) => `admin-badge ${isActive ? 'active' : ''}`}>
              Admin
            </NavLink>
          )}
          <button className="btn-outline" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      <nav className="tabbar">
        <NavLink to="/app/map" className={({ isActive }) => isActive ? 'active' : ''}>Map</NavLink>
        <NavLink to="/app/directory" className={({ isActive }) => isActive ? 'active' : ''}>Directory</NavLink>
        <NavLink to="/app/profile" className={({ isActive }) => isActive ? 'active' : ''}>My Profile</NavLink>
      </nav>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
