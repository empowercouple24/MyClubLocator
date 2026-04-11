import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Layout() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className="topbar">
        <span className="brand">My Club<span> Locator</span></span>
        <nav className="topbar-nav">
          <span className="topbar-user">{user?.email}</span>
          <button className="btn-outline" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      <nav className="tabbar">
        <NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}>Map</NavLink>
        <NavLink to="/directory" className={({ isActive }) => isActive ? 'active' : ''}>Directory</NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>My Profile</NavLink>
      </nav>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
