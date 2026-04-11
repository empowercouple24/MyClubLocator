import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function AdminPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [settings, setSettings] = useState({
    welcome_video_enabled: false,
    welcome_video_url: '',
    welcome_title: 'Welcome to My Club Locator!',
    welcome_message: "You're now part of the network. Watch the video below to get started, then add your club to the map.",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAdmin) { navigate('/map'); return }
    loadSettings()
  }, [isAdmin])

  async function loadSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single()
    if (data) setSettings(data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 1, ...settings }, { onConflict: 'id' })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (!isAdmin) return null
  if (loading) return <div className="loading">Loading admin…</div>

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>Admin Settings</h2>
        <p className="profile-sub">Manage platform settings for all members.</p>
      </div>

      {/* Welcome Modal Settings */}
      <div className="admin-section">
        <h3 className="admin-section-title">Welcome Modal</h3>
        <p className="admin-section-desc">Controls the modal shown to new members on their first login.</p>

        <div className="admin-toggle-row">
          <div>
            <div className="admin-toggle-label">Show welcome video</div>
            <div className="admin-toggle-hint">When off, the modal shows without a video</div>
          </div>
          <button
            className={`toggle-btn ${settings.welcome_video_enabled ? 'on' : 'off'}`}
            onClick={() => setSettings(s => ({ ...s, welcome_video_enabled: !s.welcome_video_enabled }))}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="fgrid">
          <div className="field">
            <label>Modal title</label>
            <input
              type="text"
              value={settings.welcome_title}
              onChange={e => setSettings(s => ({ ...s, welcome_title: e.target.value }))}
              placeholder="Welcome to My Club Locator!"
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Welcome message</label>
            <textarea
              rows={3}
              value={settings.welcome_message}
              onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
              placeholder="You're now part of the network…"
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Video embed URL</label>
            <input
              type="url"
              value={settings.welcome_video_url}
              onChange={e => setSettings(s => ({ ...s, welcome_video_url: e.target.value }))}
              placeholder="https://www.youtube.com/embed/VIDEO_ID"
              disabled={!settings.welcome_video_enabled}
            />
            <span className="field-hint">Use the YouTube embed URL format: youtube.com/embed/VIDEO_ID</span>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        {saved && <span className="save-confirm">✓ Settings saved</span>}
        <button className="btn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
