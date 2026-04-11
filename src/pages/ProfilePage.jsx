import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const DEFAULT_FORM = {
  business_name: '',
  phone: '',
  address: '',
  city: '',
  state_zip: '',
  website: '',
  hours_monday_open: '', hours_monday_close: '',
  hours_tuesday_open: '', hours_tuesday_close: '',
  hours_wednesday_open: '', hours_wednesday_close: '',
  hours_thursday_open: '', hours_thursday_close: '',
  hours_friday_open: '', hours_friday_close: '',
  hours_saturday_open: '', hours_saturday_close: '',
  hours_sunday_open: '', hours_sunday_close: '',
  social_facebook: '',
  social_instagram: '',
  social_tiktok: '',
  social_youtube: '',
}

async function geocodeAddress(address) {
  try {
    const encoded = encodeURIComponent(address)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (e) {
    console.error('Geocoding failed:', e)
  }
  return null
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    async function load() {
      if (!user) return
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setHasProfile(true)
        // Map DB row back to form fields
        const f = { ...DEFAULT_FORM }
        Object.keys(DEFAULT_FORM).forEach(key => {
          if (data[key] !== undefined && data[key] !== null) f[key] = data[key]
        })
        setForm(f)
      }
      setLoading(false)
    }
    load()
  }, [user])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    setSaving(true)

    // Geocode the full address for map placement
    const fullAddress = [form.address, form.city, form.state_zip].filter(Boolean).join(', ')
    const coords = fullAddress ? await geocodeAddress(fullAddress) : null

    const record = {
      user_id: user.id,
      ...form,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }

    let result
    if (hasProfile) {
      result = await supabase
        .from('locations')
        .update(record)
        .eq('user_id', user.id)
    } else {
      result = await supabase
        .from('locations')
        .insert(record)
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setHasProfile(true)
      setToast(true)
      setTimeout(() => setToast(false), 3000)
    }
    setSaving(false)
  }

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : '?'

  if (loading) return <div className="loading">Loading profile…</div>

  return (
    <div className="profile-page">
      <div className="profile-head">
        <div className="avatar">{initials}</div>
        <div>
          <div className="profile-name">
            {form.business_name || 'Your Club'}
            {hasProfile && <span className="badge-live" style={{ marginLeft: 8 }}>Live</span>}
          </div>
          <div className="profile-email">{user?.email}</div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Business Info */}
      <div className="sec-card">
        <div className="sec-label">Business info</div>
        <div className="fgrid">
          <div className="pf">
            <label>Business name</label>
            <input type="text" value={form.business_name} onChange={e => setField('business_name', e.target.value)} placeholder="Your Club Name" />
          </div>
          <div className="pf">
            <label>Phone number</label>
            <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="(555) 000-0000" />
          </div>
        </div>
        <div className="fgrid one">
          <div className="pf">
            <label>Street address</label>
            <input type="text" value={form.address} onChange={e => setField('address', e.target.value)} placeholder="123 Main St" />
          </div>
        </div>
        <div className="fgrid" style={{ marginTop: 14 }}>
          <div className="pf">
            <label>City</label>
            <input type="text" value={form.city} onChange={e => setField('city', e.target.value)} placeholder="Mentor" />
          </div>
          <div className="pf">
            <label>State / ZIP</label>
            <input type="text" value={form.state_zip} onChange={e => setField('state_zip', e.target.value)} placeholder="OH 44060" />
          </div>
        </div>
        <div className="fgrid one" style={{ marginTop: 14 }}>
          <div className="pf">
            <label>Website URL</label>
            <input type="text" value={form.website} onChange={e => setField('website', e.target.value)} placeholder="yoursite.com" />
          </div>
        </div>
      </div>

      {/* Hours */}
      <div className="sec-card">
        <div className="sec-label">Hours of operation</div>
        <table className="hrs-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Opens</th>
              <th>Closes</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, i) => (
              <tr key={day}>
                <td>{DAY_LABELS[i]}</td>
                <td>
                  <input
                    type="time"
                    value={form[`hours_${day}_open`]}
                    onChange={e => setField(`hours_${day}_open`, e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={form[`hours_${day}_close`]}
                    onChange={e => setField(`hours_${day}_close`, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
          Leave blank for days you are closed.
        </p>
      </div>

      {/* Social Media */}
      <div className="sec-card">
        <div className="sec-label">Social media</div>
        {[
          { key: 'social_facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage' },
          { key: 'social_instagram', label: 'Instagram', placeholder: '@yourhandle' },
          { key: 'social_tiktok', label: 'TikTok', placeholder: '@yourhandle' },
          { key: 'social_youtube', label: 'YouTube', placeholder: 'youtube.com/yourchannel' },
        ].map(({ key, label, placeholder }) => (
          <div className="soc-row" key={key}>
            <span className="soc-lbl">{label}</span>
            <div className="pf">
              <input
                type="text"
                value={form[key]}
                onChange={e => setField(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="save-bar">
        <button className="btn-outline" onClick={() => window.location.reload()}>
          Discard changes
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & update map'}
        </button>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>
        Location saved and live on the map
      </div>
    </div>
  )
}
