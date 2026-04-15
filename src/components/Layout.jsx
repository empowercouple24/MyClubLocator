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
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    async function checkAdmin() {
      const [{ data: settingsData }, { count: contactCount }, { count: notifCount }] = await Promise.all([
        supabase.from('app_settings').select(ACCESS_KEYS.join(',')).eq('id', 1).single(),
        supabase.from('contact_submissions').select('id', { count: 'exact', head: true }).or('is_read.eq.false,is_read.is.null'),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).or('is_read.eq.false,is_read.is.null'),
      ])
      if (settingsData) setAnyPaused(ACCESS_KEYS.some(k => settingsData[k] === false))
      setUnreadCount((contactCount || 0) + (notifCount || 0))
    }
    checkAdmin()

    // Live-update badge when new messages arrive
    const sub = supabase.channel('layout-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contact_submissions' }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contact_submissions', filter: 'is_read=eq.true' }, () => {
        setUnreadCount(prev => Math.max(0, prev - 1))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: 'is_read=eq.true' }, () => {
        setUnreadCount(prev => Math.max(0, prev - 1))
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [isAdmin])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <WelcomeModal />

      <header className="topbar">
        <NavLink to="/app/map" className="brand" style={{ textDecoration: 'none' }}>
          <svg className="brand-target" width="22" height="22" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3.5" fill="#4CAF82"/>
            <circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/>
            <line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          My<span>Club</span> Locator
        </NavLink>
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
              {unreadCount > 0 && (
                <span className="tab-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
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
