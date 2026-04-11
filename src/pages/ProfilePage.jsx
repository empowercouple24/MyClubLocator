import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function buildYears() {
  const y = []
  for (let yr = new Date().getFullYear(); yr >= 2000; yr--) y.push(String(yr))
  return y
}
const YEARS = buildYears()

const DEFAULT_FORM = {
  // Primary owner
  first_name: '', last_name: '', phone: '', owner_email: '',
  // Second owner
  owner2_first_name: '', owner2_last_name: '', owner2_email: '', owner2_phone: '',
  // Club info
  business_name: '', club_phone: '', club_email: '', website: '',
  // Address
  address: '', city: '', state: '', zip: '',
  // Opened
  opened_month: '', opened_year: '',
  // Hours
  hours_monday_open: '', hours_monday_close: '',
  hours_tuesday_open: '', hours_tuesday_close: '',
  hours_wednesday_open: '', hours_wednesday_close: '',
  hours_thursday_open: '', hours_thursday_close: '',
  hours_friday_open: '', hours_friday_close: '',
  hours_saturday_open: '', hours_saturday_close: '',
  hours_sunday_open: '', hours_sunday_close: '',
  // Social
  social_facebook: '', social_instagram: '', social_tiktok: '', social_youtube: '',
  // Story prompts
  story_why: '', story_favorite_part: '', story_favorite_products: '', story_unique: '',
}

async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

async function lookupZip(zip) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&postalcode=${zip}&country=US&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    if (data?.[0]) {
      const parts = data[0].display_name.split(', ')
      return { city: parts[0] || '', state: parts[parts.length - 2] || '' }
    }
  } catch {}
  return null
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveAction, setSaveAction] = useState(null)
  const [toast, setToast] = useState('')
  const [errors, setErrors] = useState({})
  const [hasProfile, setHasProfile] = useState(false)
  const [showOwner2, setShowOwner2] = useState(false)
  const [zipLooking, setZipLooking] = useState(false)

  // Photo state
  const [logoUrl, setLogoUrl] = useState(null)
  const [photoUrls, setPhotoUrls] = useState([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const logoInputRef = useRef()
  const photoInputRef = useRef()

  // Hours copy
  const [copySource, setCopySource] = useState(null)
  const [copyTargets, setCopyTargets] = useState({})

  useEffect(() => {
    async function load() {
      if (!user) return
      const { data } = await supabase.from('locations').select('*').eq('user_id', user.id).single()
      if (data) {
        setHasProfile(true)
        const f = { ...DEFAULT_FORM }
        Object.keys(DEFAULT_FORM).forEach(k => { if (data[k] != null) f[k] = data[k] })
        setForm(f)
        if (data.owner2_first_name) setShowOwner2(true)
        if (data.logo_url) setLogoUrl(data.logo_url)
        if (data.photo_urls) setPhotoUrls(data.photo_urls)
      }
      setLoading(false)
    }
    load()
  }, [user])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }

  async function handleZipBlur(zip) {
    if (zip.length < 5) return
    setZipLooking(true)
    const result = await lookupZip(zip)
    if (result) setForm(f => ({ ...f, city: result.city, state: result.state }))
    setZipLooking(false)
  }

  // ── Photo uploads ──────────────────────────────────────────
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/logo.${ext}`
    const { error } = await supabase.storage.from('club-photos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
    setUploadingLogo(false)
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingPhoto(true)
    const newUrls = [...photoUrls]
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('club-photos').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }
    setPhotoUrls(newUrls)
    setUploadingPhoto(false)
  }

  async function removePhoto(url) {
    setPhotoUrls(p => p.filter(u => u !== url))
  }

  // ── Validation ─────────────────────────────────────────────
  function validate() {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim()) e.last_name = 'Required'
    if (!form.phone.trim()) e.phone = 'Required'
    if (!form.business_name.trim()) e.business_name = 'Required'
    if (!form.address.trim()) e.address = 'Required'
    if (!form.zip.trim()) e.zip = 'Required'
    if (!form.city.trim()) e.city = 'Required'
    if (!form.state.trim()) e.state = 'Required'
    if (!form.opened_month) e.opened_month = 'Required'
    if (!form.opened_year) e.opened_year = 'Required'
    const hasHours = DAYS.some(d => form[`hours_${d}_open`] && form[`hours_${d}_close`])
    if (!hasHours) e.hours = 'At least one day of hours is required'
    DAYS.forEach(d => {
      const o = form[`hours_${d}_open`], c = form[`hours_${d}_close`]
      if ((o && !c) || (!o && c)) e[`hours_${d}`] = 'Both open and close required'
    })
    if (showOwner2) {
      if (!form.owner2_first_name.trim()) e.owner2_first_name = 'Required'
      if (!form.owner2_last_name.trim()) e.owner2_last_name = 'Required'
    }
    return e
  }

  // ── Save ───────────────────────────────────────────────────
  async function handleSave(action) {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaveAction(action)
    setSaving(true)

    const fullAddress = [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ')
    const coords = fullAddress ? await geocodeAddress(fullAddress) : null

    const record = {
      user_id: user.id,
      ...form,
      state_zip: `${form.state} ${form.zip}`.trim(),
      logo_url: logoUrl,
      photo_urls: photoUrls,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }

    const result = hasProfile
      ? await supabase.from('locations').update(record).eq('user_id', user.id)
      : await supabase.from('locations').insert(record)

    if (result.error) {
      setErrors({ _general: result.error.message })
      setSaving(false)
      setSaveAction(null)
      return
    }

    setHasProfile(true)
    if (action === 'map') {
      navigate('/map')
    } else {
      setToast('Profile saved and live on the map ✓')
      setTimeout(() => setToast(''), 3000)
    }
    setSaving(false)
    setSaveAction(null)
  }

  // ── Hours copy ─────────────────────────────────────────────
  function applyCopyToTargets() {
    if (!copySource) return
    const openVal = form[`hours_${copySource}_open`]
    const closeVal = form[`hours_${copySource}_close`]
    const updates = {}
    Object.entries(copyTargets).forEach(([day, checked]) => {
      if (checked && day !== copySource) {
        updates[`hours_${day}_open`] = openVal
        updates[`hours_${day}_close`] = closeVal
      }
    })
    setForm(f => ({ ...f, ...updates }))
    setCopySource(null)
    setCopyTargets({})
  }

  function toggleCopyTarget(day) { setCopyTargets(t => ({ ...t, [day]: !t[day] })) }
  function selectAllTargets() { const t = {}; DAYS.forEach(d => { if (d !== copySource) t[d] = true }); setCopyTargets(t) }
  function selectWeekdays() { const t = {}; WEEKDAYS.forEach(d => { if (d !== copySource) t[d] = true }); setCopyTargets(t) }

  if (loading) return <div className="loading">Loading profile…</div>

  const errorCount = Object.keys(errors).filter(k => k !== '_general' && errors[k]).length

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>{hasProfile ? 'My Profile' : 'Set Up Your Club'}</h2>
        <p className="profile-sub">{hasProfile ? 'Update your club info below.' : 'Fill out your profile to appear on the map.'}</p>
      </div>

      {errors._general && <div className="error-msg">{errors._general}</div>}
      {errorCount > 0 && (
        <div className="error-msg">Please fix {errorCount} required field{errorCount > 1 ? 's' : ''} below.</div>
      )}

      {/* ── CARD 1: Primary Owner ── */}
      <div className="sec-card">
        <div className="sec-label">Primary Owner</div>
        <div className="fgrid">
          <div className="pf">
            <label>First name <span className="req-star">*</span></label>
            <input type="text" value={form.first_name} onChange={e => setField('first_name', e.target.value)}
              placeholder="First name" className={errors.first_name ? 'input-err' : ''} />
            {errors.first_name && <span className="field-err">{errors.first_name}</span>}
          </div>
          <div className="pf">
            <label>Last name <span className="req-star">*</span></label>
            <input type="text" value={form.last_name} onChange={e => setField('last_name', e.target.value)}
              placeholder="Last name" className={errors.last_name ? 'input-err' : ''} />
            {errors.last_name && <span className="field-err">{errors.last_name}</span>}
          </div>
          <div className="pf">
            <label>Phone <span className="req-star">*</span></label>
            <input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)}
              placeholder="(555) 000-0000" className={errors.phone ? 'input-err' : ''} />
            {errors.phone && <span className="field-err">{errors.phone}</span>}
          </div>
          <div className="pf">
            <label>Email <span className="optional-tag">optional</span></label>
            <input type="email" value={form.owner_email} onChange={e => setField('owner_email', e.target.value)}
              placeholder="you@example.com" />
          </div>
        </div>

        {/* Second owner */}
        {!showOwner2 ? (
          <button className="add-owner-btn" onClick={() => setShowOwner2(true)}>
            + Add a second owner
          </button>
        ) : (
          <div className="owner2-block">
            <div className="owner2-header">
              <span>Second Owner</span>
              <button className="owner2-remove" onClick={() => {
                setShowOwner2(false)
                ;['owner2_first_name','owner2_last_name','owner2_email','owner2_phone'].forEach(k => setField(k,''))
              }}>Remove</button>
            </div>
            <div className="fgrid">
              <div className="pf">
                <label>First name <span className="req-star">*</span></label>
                <input type="text" value={form.owner2_first_name} onChange={e => setField('owner2_first_name', e.target.value)}
                  placeholder="First name" className={errors.owner2_first_name ? 'input-err' : ''} />
                {errors.owner2_first_name && <span className="field-err">{errors.owner2_first_name}</span>}
              </div>
              <div className="pf">
                <label>Last name <span className="req-star">*</span></label>
                <input type="text" value={form.owner2_last_name} onChange={e => setField('owner2_last_name', e.target.value)}
                  placeholder="Last name" className={errors.owner2_last_name ? 'input-err' : ''} />
                {errors.owner2_last_name && <span className="field-err">{errors.owner2_last_name}</span>}
              </div>
              <div className="pf">
                <label>Phone <span className="optional-tag">optional</span></label>
                <input type="tel" value={form.owner2_phone} onChange={e => setField('owner2_phone', e.target.value)}
                  placeholder="(555) 000-0000" />
              </div>
              <div className="pf">
                <label>Email <span className="optional-tag">optional</span></label>
                <input type="email" value={form.owner2_email} onChange={e => setField('owner2_email', e.target.value)}
                  placeholder="email@example.com" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CARD 2: Club Info ── */}
      <div className="sec-card">
        <div className="sec-label">Club Info</div>
        <div className="fgrid">
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club name <span className="req-star">*</span></label>
            <input type="text" value={form.business_name} onChange={e => setField('business_name', e.target.value)}
              placeholder="Your Club Name" className={errors.business_name ? 'input-err' : ''} />
            {errors.business_name && <span className="field-err">{errors.business_name}</span>}
          </div>
          <div className="pf">
            <label>Club phone <span className="optional-tag">optional</span></label>
            <input type="tel" value={form.club_phone} onChange={e => setField('club_phone', e.target.value)}
              placeholder="(555) 000-0000" />
          </div>
          <div className="pf">
            <label>Club email <span className="optional-tag">optional</span></label>
            <input type="email" value={form.club_email} onChange={e => setField('club_email', e.target.value)}
              placeholder="club@example.com" />
          </div>
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Website <span className="optional-tag">optional</span></label>
            <input type="text" value={form.website} onChange={e => setField('website', e.target.value)}
              placeholder="yoursite.com" />
          </div>
        </div>

        {/* Address — ZIP first in tab order, city/state dimmed */}
        <div className="addr-grid">
          <div className="pf addr-street">
            <label>Street address <span className="req-star">*</span></label>
            <input type="text" value={form.address} onChange={e => setField('address', e.target.value)}
              placeholder="123 Main St" tabIndex={1}
              className={errors.address ? 'input-err' : ''} />
            {errors.address && <span className="field-err">{errors.address}</span>}
          </div>
          <div className="pf addr-city">
            <label className="dimmed-label">City <span className="req-star">*</span> <span className="autofill-hint">auto-filled</span></label>
            <input type="text" value={form.city} onChange={e => setField('city', e.target.value)}
              placeholder="Auto-filled from ZIP" tabIndex={3}
              className={`dimmed-input ${errors.city ? 'input-err' : ''}`} />
            {errors.city && <span className="field-err">{errors.city}</span>}
          </div>
          <div className="pf addr-state">
            <label className="dimmed-label">State <span className="req-star">*</span> <span className="autofill-hint">auto-filled</span></label>
            <input type="text" value={form.state} onChange={e => setField('state', e.target.value)}
              placeholder="Auto-filled" tabIndex={4}
              className={`dimmed-input ${errors.state ? 'input-err' : ''}`} />
            {errors.state && <span className="field-err">{errors.state}</span>}
          </div>
          <div className="pf addr-zip">
            <label>ZIP code <span className="req-star">*</span></label>
            <div style={{ position: 'relative' }}>
              <input type="text" value={form.zip}
                onChange={e => setField('zip', e.target.value)}
                onBlur={e => handleZipBlur(e.target.value)}
                placeholder="44060" maxLength={10} tabIndex={2}
                className={errors.zip ? 'input-err' : ''} />
              {zipLooking && <span className="zip-loading">Looking up…</span>}
            </div>
            {errors.zip && <span className="field-err">{errors.zip}</span>}
          </div>
        </div>
      </div>

      {/* ── CARD 3: Club Specifics ── */}
      <div className="sec-card">
        <div className="sec-label">Club Specifics</div>

        {/* When opened */}
        <div className="fgrid" style={{ marginBottom: 20 }}>
          <div className="pf">
            <label>Month opened <span className="req-star">*</span></label>
            <select value={form.opened_month} onChange={e => setField('opened_month', e.target.value)}
              className={errors.opened_month ? 'input-err' : ''}>
              <option value="">Select month</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {errors.opened_month && <span className="field-err">{errors.opened_month}</span>}
          </div>
          <div className="pf">
            <label>Year opened <span className="req-star">*</span></label>
            <select value={form.opened_year} onChange={e => setField('opened_year', e.target.value)}
              className={errors.opened_year ? 'input-err' : ''}>
              <option value="">Select year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {errors.opened_year && <span className="field-err">{errors.opened_year}</span>}
          </div>
        </div>

        {/* Hours */}
        <div className="sec-sublabel">Hours of operation <span className="req-star">*</span></div>
        {errors.hours && <div className="field-err" style={{ marginBottom: 8 }}>{errors.hours}</div>}
        <table className="hrs-table">
          <thead>
            <tr><th>Day</th><th>Opens</th><th>Closes</th><th>Copy</th></tr>
          </thead>
          <tbody>
            {DAYS.map((day, i) => (
              <tr key={day} className={errors[`hours_${day}`] ? 'row-err' : ''}>
                <td className="hrs-day-label">{DAY_LABELS[i]}</td>
                <td><input type="time" value={form[`hours_${day}_open`]} onChange={e => setField(`hours_${day}_open`, e.target.value)} /></td>
                <td><input type="time" value={form[`hours_${day}_close`]} onChange={e => setField(`hours_${day}_close`, e.target.value)} /></td>
                <td>
                  <button className="copy-hours-btn" title="Copy to other days"
                    disabled={!form[`hours_${day}_open`] || !form[`hours_${day}_close`]}
                    onClick={() => { setCopySource(day); setCopyTargets({}) }}>⇢</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {copySource && (
          <div className="copy-panel">
            <div className="copy-panel-title">
              Copy {DAY_LABELS[DAYS.indexOf(copySource)]} hours ({form[`hours_${copySource}_open`]} – {form[`hours_${copySource}_close`]}) to:
            </div>
            <div className="copy-quick-btns">
              <button onClick={selectAllTargets}>Select all</button>
              <button onClick={selectWeekdays}>Weekdays</button>
              <button onClick={() => setCopyTargets({})}>Clear all</button>
            </div>
            <div className="copy-checkboxes">
              {DAYS.filter(d => d !== copySource).map(d => (
                <label key={d} className="copy-check-label">
                  <input type="checkbox" checked={!!copyTargets[d]} onChange={() => toggleCopyTarget(d)} />
                  {DAY_LABELS[DAYS.indexOf(d)]}
                </label>
              ))}
            </div>
            <div className="copy-actions">
              <button className="copy-apply-btn" onClick={applyCopyToTargets}
                disabled={!Object.values(copyTargets).some(Boolean)}>Apply</button>
              <button className="copy-cancel-btn" onClick={() => setCopySource(null)}>Cancel</button>
            </div>
          </div>
        )}
        <p className="hrs-hint">Leave open and close blank for days you are closed.</p>

        {/* Social Media */}
        <div className="sec-sublabel" style={{ marginTop: 24 }}>Social media <span className="optional-tag">all optional</span></div>
        {[
          { key: 'social_facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage' },
          { key: 'social_instagram', label: 'Instagram', placeholder: '@yourhandle' },
          { key: 'social_tiktok', label: 'TikTok', placeholder: '@yourhandle' },
          { key: 'social_youtube', label: 'YouTube', placeholder: 'youtube.com/yourchannel' },
        ].map(({ key, label, placeholder }) => (
          <div className="soc-row" key={key}>
            <span className="soc-lbl">{label}</span>
            <div className="pf"><input type="text" value={form[key]}
              onChange={e => setField(key, e.target.value)} placeholder={placeholder} /></div>
          </div>
        ))}
      </div>

      {/* ── CARD 4: Photos ── */}
      <div className="sec-card">
        <div className="sec-label">Club Photos <span className="optional-tag">optional</span></div>

        {/* Logo */}
        <div className="photo-section">
          <div className="photo-section-title">Club Logo</div>
          <div className="logo-upload-row">
            {logoUrl ? (
              <div className="logo-preview">
                <img src={logoUrl} alt="Club logo" />
                <button className="photo-remove-btn" onClick={() => setLogoUrl(null)}>✕</button>
              </div>
            ) : (
              <div className="upload-placeholder logo-placeholder">
                <span>No logo yet</span>
              </div>
            )}
            <div>
              <button className="upload-btn" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? 'Uploading…' : logoUrl ? '↑ Replace Logo' : '↑ Upload Logo'}
              </button>
              <p className="upload-hint">PNG or JPG, square preferred</p>
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        {/* Club photos */}
        <div className="photo-section" style={{ marginTop: 20 }}>
          <div className="photo-section-title">Club Photos</div>
          <p className="upload-hint" style={{ marginBottom: 12 }}>Show off your space, team, and vibe. Up to 6 photos.</p>
          <div className="photos-grid">
            {photoUrls.map((url, i) => (
              <div key={i} className="photo-thumb">
                <img src={url} alt={`Club photo ${i+1}`} />
                <button className="photo-remove-btn" onClick={() => removePhoto(url)}>✕</button>
              </div>
            ))}
            {photoUrls.length < 6 && (
              <button className="photo-add-tile" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? '…' : '+'}
              </button>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>
      </div>

      {/* ── CARD 5: Your Story ── */}
      <div className="sec-card">
        <div className="sec-label">Your Story <span className="optional-tag">all optional</span></div>
        <p className="story-intro">Share a little about yourself and your club. These may be shown on your club's profile page.</p>

        {[
          { key: 'story_why', label: 'Why did you decide to open your club?' },
          { key: 'story_favorite_part', label: 'What is your favorite part of club ownership?' },
          { key: 'story_favorite_products', label: 'What are your favorite products?' },
          { key: 'story_unique', label: 'What is something unique and interesting about yourself?' },
        ].map(({ key, label }) => (
          <div className="pf story-field" key={key}>
            <label>{label}</label>
            <textarea rows={3} value={form[key]} onChange={e => setField(key, e.target.value)}
              placeholder="Share your answer here…" />
          </div>
        ))}
      </div>

      {/* ── Save buttons ── */}
      <div className="save-bar">
        <button className="btn-save" onClick={() => handleSave('save')}
          disabled={saving && saveAction === 'save'}>
          {saving && saveAction === 'save' ? 'Saving…' : 'Save My Profile'}
        </button>
        <button className="btn-save-map" onClick={() => handleSave('map')}
          disabled={saving && saveAction === 'map'}>
          {saving && saveAction === 'map' ? 'Saving…' : 'Save & Return to Map'}
        </button>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}
