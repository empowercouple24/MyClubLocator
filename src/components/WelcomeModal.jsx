import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function WelcomeModal() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [show, setShow]           = useState(false)
  const [settings, setSettings]   = useState(null)
  const [hasClub, setHasClub]     = useState(false)
  const [clubs, setClubs]         = useState([])
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(`welcome_seen_${user.id}`)) return
    async function load() {
      const [{ data: sd }, { data: cd }] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 1).single(),
        supabase.from('locations').select('id,club_name,city,first_name').eq('user_id', user.id).order('created_at'),
      ])
      if (sd) {
        setSettings(sd); setClubs(cd || [])
        setHasClub((cd||[]).length > 0)
        setFirstName(cd?.[0]?.first_name || '')
        setShow(true)
      }
    }
    load()
  }, [user])

  function dismiss() { localStorage.setItem(`welcome_seen_${user.id}`, 'true'); setShow(false) }
  function goToProfile() { dismiss(); navigate('/app/profile') }

  function applyTags(html) {
    if (!html) return html
    const c = clubs
    return html
      .replace(/\{\{first_name\}\}/g, firstName || '')
      .replace(/\{\{club_1_name\}\}/g, c[0]?.club_name || '')
      .replace(/\{\{club_2_name\}\}/g, c[1]?.club_name || '')
      .replace(/\{\{club_3_name\}\}/g, c[2]?.club_name || '')
      .replace(/\{\{club_1_city\}\}/g, c[0]?.city || '')
      .replace(/\{\{club_2_city\}\}/g, c[1]?.city || '')
      .replace(/\{\{club_3_city\}\}/g, c[2]?.city || '')
  }

  if (!show || !settings) return null
  const videoUrl = settings.welcome_video_url || settings.welcome_video_placeholder || 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  const showVideo = settings.welcome_video_enabled && !hasClub

  return (
    <div className="modal-overlay modal-overlay--locked">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-logo">
          <svg width="32" height="32" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3.5" fill="#4CAF82"/>
            <circle cx="9" cy="9" r="7" stroke="#4CAF82" strokeWidth="1.5" fill="none"/>
            <line x1="9" y1="2" x2="9" y2="0.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="9" y1="16" x2="9" y2="17.5" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="2" y1="9" x2="0.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="9" x2="17.5" y2="9" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        {hasClub ? (
          <>
            <h2 className="modal-title">{applyTags(settings.welcome_returning_title) || (firstName ? `Welcome back, ${firstName}!` : 'Welcome back!')}</h2>
            <div className="modal-message rte-content" dangerouslySetInnerHTML={{ __html: applyTags(settings.welcome_message) || "You're part of the network. Explore the map to see clubs near you." }} />
            <div className="modal-actions"><button className="modal-btn-primary" onClick={dismiss}>Explore the Map</button></div>
          </>
        ) : (
          <>
            <h2 className="modal-title">{settings.welcome_title || 'Welcome to My Club Locator!'}</h2>
            <div className="modal-message rte-content" dangerouslySetInnerHTML={{ __html: applyTags(settings.welcome_message) || "You're now part of the network. Watch the video below to get started, then add your club to the map." }} />
            {showVideo && (
              <div className="modal-video">
                <iframe src={videoUrl} title="Welcome video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            )}
            <div className="modal-actions"><button className="modal-btn-primary" onClick={goToProfile}>Add My Club</button></div>
          </>
        )}
        {settings.welcome_disclaimer_enabled !== false && (
          <div className="modal-disclaimer rte-content" dangerouslySetInnerHTML={{ __html: applyTags(settings.welcome_disclaimer) || 'Disclaimer placeholder \u2014 edit in Admin \u2192 Settings.' }} />
        )}
      </div>
    </div>
  )
}
