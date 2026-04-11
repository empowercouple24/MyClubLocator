import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function WelcomeModal() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [settings, setSettings] = useState(null)
  const [hasClub, setHasClub] = useState(false)

  useEffect(() => {
    if (!user) return
    const key = `welcome_seen_${user.id}`
    const seen = localStorage.getItem(key)
    if (seen) return

    async function load() {
      const [{ data: settingsData }, { data: clubData }] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 1).single(),
        supabase.from('locations').select('id').eq('user_id', user.id).maybeSingle(),
      ])
      if (settingsData) {
        setSettings(settingsData)
        setHasClub(!!clubData)
        setShow(true)
      }
    }
    load()
  }, [user])

  function dismiss() {
    localStorage.setItem(`welcome_seen_${user.id}`, 'true')
    setShow(false)
  }

  function goToProfile() {
    dismiss()
    navigate('/profile')
  }

  if (!show || !settings) return null

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || ''

  // Determine video URL — use saved URL or fall back to placeholder
  const PLACEHOLDER_VIDEO = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  const videoUrl = settings.welcome_video_url || PLACEHOLDER_VIDEO
  const showVideo = settings.welcome_video_enabled && !hasClub

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={dismiss} aria-label="Close">✕</button>

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
          /* ── Returning user with a club ── */
          <>
            <h2 className="modal-title">
              {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
            </h2>
            <p className="modal-message">
              {settings.welcome_message || "You're part of the network. Explore the map to see clubs near you."}
            </p>

            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={dismiss}>
                Explore the Map
              </button>
            </div>
          </>
        ) : (
          /* ── New user / no club yet ── */
          <>
            <h2 className="modal-title">{settings.welcome_title || 'Welcome to My Club Locator!'}</h2>
            <p className="modal-message">
              {settings.welcome_message || "You're now part of the network. Watch the video below to get started, then add your club to the map."}
            </p>

            {showVideo && (
              <div className="modal-video">
                <iframe
                  src={videoUrl}
                  title="Welcome video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={goToProfile}>
                Add My Club
              </button>
              <button className="modal-btn-secondary" onClick={dismiss}>
                Explore the Map
              </button>
            </div>
          </>
        )}

        {/* Disclaimer — shown to all users */}
        {(settings.welcome_disclaimer || true) && (
          <div className="modal-disclaimer">
            {settings.welcome_disclaimer ||
              'Disclaimer placeholder — edit this text in Admin → Settings.'}
          </div>
        )}

      </div>
    </div>
  )
}
