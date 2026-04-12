import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TimePicker from '../components/TimePicker'
import AddressAutocomplete from '../components/AddressAutocomplete'
import CropModal from '../components/CropModal'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function buildYears() {
  const y = []
  for (let yr = new Date().getFullYear(); yr >= 2006; yr--) y.push(String(yr))
  return y
}
const YEARS = buildYears()

// ── Phone formatting ─────────────────────────────────────────
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

const DEFAULT_FORM = {
  first_name: '', last_name: '', owner_email: '',
  owner2_first_name: '', owner2_last_name: '', owner2_email: '', owner2_herbalife_level: '',
  owner3_first_name: '', owner3_last_name: '', owner3_email: '', owner3_herbalife_level: '',
  club_name: '', club_email: '', club_phone: '', website: '',
  address: '', city: '', state: '', zip: '',
  opened_month: '', opened_year: '',
  hours_monday_open: '', hours_monday_close: '',
  hours_tuesday_open: '', hours_tuesday_close: '',
  hours_wednesday_open: '', hours_wednesday_close: '',
  hours_thursday_open: '', hours_thursday_close: '',
  hours_friday_open: '', hours_friday_close: '',
  hours_saturday_open: '', hours_saturday_close: '',
  hours_sunday_open: '', hours_sunday_close: '',
  social_facebook: '', social_instagram: '', social_tiktok: '', social_youtube: '',
  story_why: '', story_favorite_part: '', story_favorite_products: '', story_unique: '',
  story_before: '', story_goal: '',
  herbalife_level: '',
  survey_upline: '', survey_hl_month: '', survey_hl_year: '',
  survey_active_club: null, survey_club_month: '', survey_club_year: '',
  survey_trainings: '', survey_hear_how: '', survey_hear_detail: '', survey_goal: '',
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

// ── Owner photo upload widget ─────────────────────────────────
// Compact level picker for co-owners (no K/diamond sub-selection)
function OwnerLevelPicker({ value, onChange }) {
  const TIERS = [
    { val: 'Distributor',       label: 'DS',  c: '#e3e3e3', cd: '#555' },
    { val: 'Success Builder',   label: 'SB',  c: '#e3e3e3', cd: '#555' },
    { val: 'Supervisor',        label: 'SP',  c: '#64ba44', cd: '#2a6b1a' },
    { val: 'World Team',        label: 'WT',  c: '#767678', cd: '#3a3a3a' },
    { val: 'Active World Team', label: 'AWT', c: '#767678', cd: '#3a3a3a' },
    { val: 'Get Team',          label: 'GT',  c: '#e02054', cd: '#8a0020' },
    { val: 'Get Team 2500',     label: 'GP',  c: '#f39519', cd: '#7a4200' },
    { val: 'Millionaire Team',  label: 'MT',  c: '#3aac77', cd: '#0c5a32' },
    { val: 'Millionaire Team 7500', label: 'MP', c: '#84c8d3', cd: '#1a5a60' },
    { val: 'Presidents Team',   label: 'PT',  c: '#fde488', cd: '#7a5200' },
    { val: 'Chairmans Club',    label: 'CC',  c: '#c8c8d8', cd: '#2a2a40' },
    { val: 'Founders Circle',   label: 'FC',  c: '#e8e4ff', cd: '#2a1880' },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {TIERS.map(({ val, label, c, cd }) => (
        <button key={val} type="button"
          className={`lvl-btn ${value === val ? 'on' : ''}`}
          style={{ '--lvlc': c, '--lvlcd': cd, fontSize: 12, padding: '4px 10px' }}
          onClick={() => onChange(value === val ? '' : val)}>
          {label}
        </button>
      ))}
      {value && (
        <button type="button"
          style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: '0.5px solid #ccc',
            borderRadius: 6, color: '#888', cursor: 'pointer' }}
          onClick={() => onChange('')}>
          ✕ Clear
        </button>
      )}
    </div>
  )
}

function OwnerPhotoUpload({ label, photoUrl, onUpload, uploading }) {
  const inputRef = useRef()
  return (
    <div className="owner-photo-upload">
      <div className="owner-photo-preview">
        {photoUrl
          ? <img src={photoUrl} alt={label + ' photo'} />
          : <div className="owner-photo-placeholder">👤</div>
        }
      </div>
      <div className="owner-photo-actions">
        <div className="owner-photo-label">{label} Photo <span className="optional-tag">optional</span></div>
        <button
          className="upload-btn upload-btn-sm"
          onClick={() => inputRef.current && inputRef.current.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : photoUrl ? '↑ Replace' : '↑ Upload Photo'}
        </button>
        <p className="upload-hint">Square photo works best</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onUpload}
      />
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]         = useState(DEFAULT_FORM)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveAction, setSaveAction] = useState(null)
  const [toast, setToast]       = useState('')
  const [errors, setErrors]     = useState({})
  const [hasProfile, setHasProfile] = useState(false)
  const savedFormRef = useRef(null)  // snapshot of last saved form
  const isDirty = savedFormRef.current !== null
    ? JSON.stringify(form) !== JSON.stringify(savedFormRef.current)
    : false
  const [showOwner2, setShowOwner2] = useState(false)
  const [showOwner3, setShowOwner3] = useState(false)
  const [zipLooking, setZipLooking] = useState(false)

  const [logoUrl, setLogoUrl]       = useState(null)
  const [photoUrls, setPhotoUrls]   = useState([])
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const logoInputRef  = useRef()
  const photoInputRef = useRef()

  // Crop modal state
  const [cropSrc, setCropSrc]       = useState(null)
  const [cropTarget, setCropTarget] = useState(null) // 'logo' | 'owner1' | 'owner2' | 'owner3'
  const cropInputRef = useRef()

  // Drag-to-reorder state
  const dragIdx = useRef(null)

  // Herbalife level picker state
  const [lvlTier,      setLvlTier]      = useState('')   // 'PT' | 'FCCC' | base tier
  const [lvlK,         setLvlK]         = useState('')   // 'PT' | '15K' | '20K' ... | 'CC' | 'FC'
  const [lvlDia,       setLvlDia]       = useState('')   // '1'–'15'
  const [lvlConfirmed, setLvlConfirmed] = useState(false)

  const K_LEVELS = ['PT','15K','20K','30K','40K','50K','60K','70K','80K','90K','100K','110K','120K','130K','140K','150K']
  const CC_K_LEVELS = ['CC','FC','15K','20K','30K','40K','50K','60K','70K','80K','90K','100K','110K','120K','130K','140K','150K']

  function lvlNeedsK()   { return lvlTier === 'PT' || lvlTier === 'FCCC' }
  function lvlNeedsDia() {
    if (lvlTier === 'PT' && lvlK) return true
    if (lvlTier === 'FCCC' && lvlK) return true
    return false
  }
  function lvlIsComplete() {
    if (!lvlTier) return false
    if (lvlTier === 'PT')   return !!lvlK   // diamonds optional for PT
    if (lvlTier === 'FCCC') return !!lvlK && !!lvlDia  // diamonds required for FCCC
    return true // tab team / future pres — no K or dia needed
  }

  function buildLvlValue() {
    if (!lvlTier) return ''
    if (lvlTier === 'PT') {
      const k = lvlK && lvlK !== 'PT' ? ` ${lvlK}` : ''
      const d = lvlDia ? ` ${lvlDia} 💎` : ''
      return `Presidents Team${k}${d}`
    }
    if (lvlTier === 'FCCC') {
      if (!lvlK) return ''
      let prefix
      if      (lvlK === 'CC') prefix = 'Chairmans Club'
      else if (lvlK === 'FC') prefix = 'Founders Circle'
      else    prefix = parseInt(lvlDia) >= 10 ? 'Founders Circle' : 'Chairmans Club'
      const k = (lvlK !== 'CC' && lvlK !== 'FC') ? ` ${lvlK}` : ''
      const d = lvlDia ? ` ${lvlDia} 💎` : ''
      return `${prefix}${k}${d}`
    }
    return lvlTier
  }

  function buildLvlDisplay(val) {
    if (!val) return ''
    return val.replace(/ (\d+) 💎$/, ' $1 💎')
  }

  function pickLvlTier(t) {
    setLvlTier(t); setLvlK(''); setLvlDia(''); setLvlConfirmed(false)
    // For non-PT/FCCC tiers, set herbalife_level immediately
    if (t !== 'PT' && t !== 'FCCC') setField('herbalife_level', t)
    else setField('herbalife_level', '')
  }

  function confirmLevel() {
    const val = buildLvlValue()
    setField('herbalife_level', val)
    setLvlConfirmed(true)
  }

  function changeLevel() {
    setLvlConfirmed(false)
    setField('herbalife_level', '')
  }
  const [ownerPhotoUrl,  setOwnerPhotoUrl]  = useState(null)
  const [owner2PhotoUrl, setOwner2PhotoUrl] = useState(null)
  const [owner3PhotoUrl, setOwner3PhotoUrl] = useState(null)
  const [uploadingOwnerPhoto,  setUploadingOwnerPhoto]  = useState(false)
  const [uploadingOwner2Photo, setUploadingOwner2Photo] = useState(false)
  const [uploadingOwner3Photo, setUploadingOwner3Photo] = useState(false)

  const [copySource, setCopySource]   = useState(null)
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
        savedFormRef.current = f  // snapshot on load
        if (data.owner2_first_name) setShowOwner2(true)
        if (data.owner3_first_name) setShowOwner3(true)
        if (data.logo_url) setLogoUrl(data.logo_url)
        if (data.photo_urls) setPhotoUrls(data.photo_urls)
        if (data.owner_photo_url)  setOwnerPhotoUrl(data.owner_photo_url)
        if (data.owner2_photo_url) setOwner2PhotoUrl(data.owner2_photo_url)
        if (data.owner3_photo_url) setOwner3PhotoUrl(data.owner3_photo_url)
        // Restore level picker state from saved value
        if (data.herbalife_level) {
          const lv = data.herbalife_level
          const dMatch = lv.match(/ (\d+) 💎$/)
          const kMatch = lv.match(/ (\d+K)/)
          if (/^Presidents Team/.test(lv)) {
            setLvlTier('PT')
            setLvlK(kMatch ? kMatch[1] : 'PT')
            if (dMatch) setLvlDia(dMatch[1])
          } else if (/^Chairmans Club|^Founders Circle/.test(lv)) {
            setLvlTier('FCCC')
            if (kMatch) setLvlK(kMatch[1])
            else setLvlK(/^Chairmans/.test(lv) ? 'CC' : 'FC')
            if (dMatch) setLvlDia(dMatch[1])
          } else {
            setLvlTier(lv)
          }
          setLvlConfirmed(true)
        }
      } else {
        // New user — pre-fill club_email and owner_email from their auth email
        if (user.email) {
          setForm(f => ({ ...f, club_email: user.email, owner_email: user.email }))
        }
      }
      setLoading(false)
    }
    load()
  }, [user])

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }

  function handlePhoneChange(key, raw) {
    setField(key, formatPhone(raw))
  }

  async function handleZipBlur(zip) {
    if (zip.length < 5) return
    setZipLooking(true)
    const result = await lookupZip(zip)
    if (result) setForm(f => ({ ...f, city: result.city, state: result.state }))
    setZipLooking(false)
  }

  // Open crop modal for any circular photo
  function openCrop(file, target) {
    const reader = new FileReader()
    reader.onload = e => { setCropSrc(e.target.result); setCropTarget(target) }
    reader.readAsDataURL(file)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    openCrop(file, 'logo')
    e.target.value = ''
  }

  async function saveCroppedPhoto(blob) {
    if (!cropTarget) return
    const target = cropTarget
    setCropSrc(null); setCropTarget(null)

    if (target === 'logo') {
      setUploadingLogo(true)
      const path = user.id + '/logo.jpg'
      const { error } = await supabase.storage.from('club-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) {
        const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
        setLogoUrl(data.publicUrl + '?t=' + Date.now())
      }
      setUploadingLogo(false)
    } else if (target === 'owner1') {
      setUploadingOwnerPhoto(true)
      const path = user.id + '/owner-photo.jpg'
      const { error } = await supabase.storage.from('club-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) { const { data } = supabase.storage.from('club-photos').getPublicUrl(path); setOwnerPhotoUrl(data.publicUrl + '?t=' + Date.now()) }
      setUploadingOwnerPhoto(false)
    } else if (target === 'owner2') {
      setUploadingOwner2Photo(true)
      const path = user.id + '/owner2-photo.jpg'
      const { error } = await supabase.storage.from('club-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) { const { data } = supabase.storage.from('club-photos').getPublicUrl(path); setOwner2PhotoUrl(data.publicUrl + '?t=' + Date.now()) }
      setUploadingOwner2Photo(false)
    } else if (target === 'owner3') {
      setUploadingOwner3Photo(true)
      const path = user.id + '/owner3-photo.jpg'
      const { error } = await supabase.storage.from('club-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!error) { const { data } = supabase.storage.from('club-photos').getPublicUrl(path); setOwner3PhotoUrl(data.publicUrl + '?t=' + Date.now()) }
      setUploadingOwner3Photo(false)
    }
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploadingPhoto(true)
    const newUrls = [...photoUrls]
    for (const file of files) {
      if (newUrls.length >= 10) break
      const ext = file.name.split('.').pop()
      const path = user.id + '/photos/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      const { error } = await supabase.storage.from('club-photos').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }
    setPhotoUrls(newUrls)
    setUploadingPhoto(false)
  }

  async function handleOwnerPhotoUpload(ownerNum, e, setUrl, setUploading) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const target = ownerNum === 1 ? 'owner1' : ownerNum === 2 ? 'owner2' : 'owner3'
    openCrop(file, target)
    e.target.value = ''
  }

  function removePhoto(url) { setPhotoUrls(p => p.filter(u => u !== url)) }

  function validate() {
    const e = {}
    if (!form.first_name.trim())   e.first_name = 'Required'
    if (!form.last_name.trim())    e.last_name  = 'Required'
    if (!form.club_name.trim()) e.club_name = 'Required'
    if (!form.club_email.trim())   e.club_email = 'Required'
    if (!form.address.trim())      e.address    = 'Required'
    if (!form.zip.trim())          e.zip        = 'Required'
    if (!form.city.trim())         e.city       = 'Required'
    if (!form.state.trim())        e.state      = 'Required'
    if (!form.opened_month)        e.opened_month = 'Required'
    if (!form.opened_year)         e.opened_year  = 'Required'
    if (!form.herbalife_level)     e.herbalife_level = 'Please select your level'
    const hasHours = DAYS.some(d => form['hours_' + d + '_open'] && form['hours_' + d + '_close'])
    if (!hasHours) e.hours = 'At least one day of hours is required'
    DAYS.forEach(d => {
      const o = form['hours_' + d + '_open'], c = form['hours_' + d + '_close']
      if ((o && !c) || (!o && c)) e['hours_' + d] = 'Both open and close required'
    })
    if (showOwner2) {
      if (!form.owner2_first_name.trim()) e.owner2_first_name = 'Required'
      if (!form.owner2_last_name.trim())  e.owner2_last_name  = 'Required'
    }
    if (showOwner3) {
      if (!form.owner3_first_name.trim()) e.owner3_first_name = 'Required'
      if (!form.owner3_last_name.trim())  e.owner3_last_name  = 'Required'
    }
    return e
  }

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
      user_id: user.id, ...form,
      state_zip: (form.state + ' ' + form.zip).trim(),
      logo_url: logoUrl,
      photo_urls: photoUrls,
      owner_photo_url:  ownerPhotoUrl,
      owner2_photo_url: owner2PhotoUrl,
      owner3_photo_url: owner3PhotoUrl,
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
    }

    const isFirstSave = !hasProfile
    const result = hasProfile
      ? await supabase.from('locations').update(record).eq('user_id', user.id)
      : await supabase.from('locations').insert(record)

    if (result.error) {
      setErrors({ _general: result.error.message })
      setSaving(false); setSaveAction(null)
      return
    }

    // Notify admin on first profile save
    if (isFirstSave) {
      await supabase.from('notifications').insert({
        type: 'new_profile',
        title: 'New club profile submitted',
        body: `${form.club_name || 'A new club'} just set up their profile${form.city ? ` in ${form.city}${form.state ? `, ${form.state}` : ''}` : ''}.`,
        user_id: user.id,
      })
    }

    setHasProfile(true)
    savedFormRef.current = { ...form }  // snapshot after save
    if (action === 'map') {
      navigate('/app/map')
    } else {
      setToast('Profile saved and live on the map ✓')
      setTimeout(() => setToast(''), 3000)
    }
    setSaving(false); setSaveAction(null)
  }

  function applyCopyToTargets() {
    if (!copySource) return
    const o = form['hours_' + copySource + '_open'], c = form['hours_' + copySource + '_close']
    const updates = {}
    Object.entries(copyTargets).forEach(function([day, checked]) {
      if (checked && day !== copySource) {
        updates['hours_' + day + '_open'] = o
        updates['hours_' + day + '_close'] = c
      }
    })
    setForm(f => ({ ...f, ...updates }))
    setCopySource(null); setCopyTargets({})
  }

  function toggleCopyTarget(day) { setCopyTargets(t => ({ ...t, [day]: !t[day] })) }
  function selectAllTargets() { const t = {}; DAYS.forEach(d => { if (d !== copySource) t[d] = true }); setCopyTargets(t) }
  function selectWeekdays()   { const t = {}; WEEKDAYS.forEach(d => { if (d !== copySource) t[d] = true }); setCopyTargets(t) }

  function clearOwner(num) {
    const fields = ['owner' + num + '_first_name', 'owner' + num + '_last_name', 'owner' + num + '_email']
    fields.forEach(k => setField(k, ''))
    if (num === 2) setOwner2PhotoUrl(null)
    if (num === 3) setOwner3PhotoUrl(null)
  }

  if (loading) return <div className="loading">Loading profile…</div>

  const errorCount = Object.keys(errors).filter(k => k !== '_general' && errors[k]).length

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>{hasProfile ? 'My Profile' : 'Set Up Your Club'}</h2>
        <p className="profile-sub">{hasProfile ? 'Update your club info below.' : 'Fill out your profile to appear on the map.'}</p>
      </div>

      {errors._general && <div className="error-msg">{errors._general}</div>}
      {errorCount > 0 && <div className="error-msg">Please fix {errorCount} required field{errorCount !== 1 ? 's' : ''} below.</div>}

      {/* CARD 1: Owners */}
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
        </div>
        <div className="pf owner-email-full">
          <label>Email <span className="optional-tag">optional</span></label>
          <input type="email" value={form.owner_email} onChange={e => setField('owner_email', e.target.value)}
            placeholder="your@email.com" />
        </div>
        <OwnerPhotoUpload
          label="Primary Owner"
          photoUrl={ownerPhotoUrl}
          onUpload={e => handleOwnerPhotoUpload(1, e, setOwnerPhotoUrl, setUploadingOwnerPhoto)}
          uploading={uploadingOwnerPhoto}
        />

        {/* Owner 2 */}
        {showOwner2 && (
          <div className="owner2-block">
            <div className="owner2-header">
              <span>Owner 2</span>
              <button className="owner2-remove" onClick={() => { setShowOwner2(false); clearOwner(2) }}>Remove</button>
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
            </div>
            <div className="pf owner-email-full">
              <label>Email <span className="optional-tag">optional</span></label>
              <input type="email" value={form.owner2_email} onChange={e => setField('owner2_email', e.target.value)}
                placeholder="owner2@email.com" />
            </div>
            <OwnerPhotoUpload
              label="Owner 2"
              photoUrl={owner2PhotoUrl}
              onUpload={e => handleOwnerPhotoUpload(2, e, setOwner2PhotoUrl, setUploadingOwner2Photo)}
              uploading={uploadingOwner2Photo}
            />
            <div className="pf" style={{ marginTop: 8 }}>
              <label>Herbalife Level <span className="optional-tag">optional</span></label>
              <OwnerLevelPicker
                value={form.owner2_herbalife_level}
                onChange={v => setField('owner2_herbalife_level', v)}
              />
            </div>
          </div>
        )}

        {/* Owner 3 */}
        {showOwner3 && (
          <div className="owner2-block">
            <div className="owner2-header">
              <span>Owner 3</span>
              <button className="owner2-remove" onClick={() => { setShowOwner3(false); clearOwner(3) }}>Remove</button>
            </div>
            <div className="fgrid">
              <div className="pf">
                <label>First name <span className="req-star">*</span></label>
                <input type="text" value={form.owner3_first_name} onChange={e => setField('owner3_first_name', e.target.value)}
                  placeholder="First name" className={errors.owner3_first_name ? 'input-err' : ''} />
                {errors.owner3_first_name && <span className="field-err">{errors.owner3_first_name}</span>}
              </div>
              <div className="pf">
                <label>Last name <span className="req-star">*</span></label>
                <input type="text" value={form.owner3_last_name} onChange={e => setField('owner3_last_name', e.target.value)}
                  placeholder="Last name" className={errors.owner3_last_name ? 'input-err' : ''} />
                {errors.owner3_last_name && <span className="field-err">{errors.owner3_last_name}</span>}
              </div>
            </div>
            <div className="pf owner-email-full">
              <label>Email <span className="optional-tag">optional</span></label>
              <input type="email" value={form.owner3_email} onChange={e => setField('owner3_email', e.target.value)}
                placeholder="owner3@email.com" />
            </div>
            <OwnerPhotoUpload
              label="Owner 3"
              photoUrl={owner3PhotoUrl}
              onUpload={e => handleOwnerPhotoUpload(3, e, setOwner3PhotoUrl, setUploadingOwner3Photo)}
              uploading={uploadingOwner3Photo}
            />
            <div className="pf" style={{ marginTop: 8 }}>
              <label>Herbalife Level <span className="optional-tag">optional</span></label>
              <OwnerLevelPicker
                value={form.owner3_herbalife_level}
                onChange={v => setField('owner3_herbalife_level', v)}
              />
            </div>
          </div>
        )}

        <div className="add-owner-row">
          {!showOwner2 && (
            <button className="add-owner-btn" onClick={() => setShowOwner2(true)}>+ Add a second owner</button>
          )}
          {showOwner2 && !showOwner3 && (
            <button className="add-owner-btn" onClick={() => setShowOwner3(true)}>+ Add a third owner</button>
          )}
        </div>
      </div>

      {/* CARD 2: Club Info — website removed, phone formatted */}
      <div className="sec-card">
        <div className="sec-label">Club Info</div>
        <div className="fgrid">
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club name <span className="req-star">*</span></label>
            <input type="text" value={form.club_name} onChange={e => setField('club_name', e.target.value)}
              placeholder="Your Club Name" className={errors.club_name ? 'input-err' : ''} />
            {errors.club_name && <span className="field-err">{errors.club_name}</span>}
          </div>
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club email <span className="req-star">*</span></label>
            <input type="email" value={form.club_email} onChange={e => setField('club_email', e.target.value)}
              placeholder="hello@yourclub.com" className={errors.club_email ? 'input-err' : ''}
              readOnly={!hasProfile && !!user?.email}
              style={!hasProfile && user?.email ? { background: '#f8faf9', color: '#555', cursor: 'default' } : {}} />
            {!hasProfile && user?.email && (
              <span className="field-hint">Pre-filled from your account email — you can update this after saving</span>
            )}
            {errors.club_email && <span className="field-err">{errors.club_email}</span>}
          </div>
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club phone <span className="optional-tag">optional</span></label>
            <input type="tel" value={form.club_phone}
              onChange={e => handlePhoneChange('club_phone', e.target.value)}
              placeholder="(555) 000-0000" />
          </div>
        </div>

        {/* Address */}
        <div className="addr-grid">
          <div className="pf addr-street">
            <label>Street address <span className="req-star">*</span></label>
            <AddressAutocomplete
              value={form.address}
              onChange={val => setField('address', val)}
              onSelect={({ street, city, state, zip }) => {
                setForm(f => ({ ...f, address: street, city, state, zip }))
                if (errors.address) setErrors(e => ({ ...e, address: null }))
              }}
              error={!!errors.address}
            />
            {errors.address && <span className="field-err">{errors.address}</span>}
          </div>
          <div className="pf addr-city">
            <label className="dimmed-label">City <span className="autofill-hint">✦ auto-filled</span></label>
            <input type="text" value={form.city} readOnly tabIndex={-1}
              placeholder="Auto-filled from address" className="dimmed-input" />
          </div>
          <div className="pf addr-state">
            <label className="dimmed-label">State <span className="autofill-hint">✦ auto-filled</span></label>
            <input type="text" value={form.state} readOnly tabIndex={-1}
              placeholder="Auto-filled from address" className="dimmed-input" />
          </div>
          <div className="pf addr-zip">
            <label className="dimmed-label">ZIP <span className="autofill-hint">✦ auto-filled</span></label>
            <input type="text" value={form.zip} readOnly tabIndex={-1}
              placeholder="Auto-filled from address" className="dimmed-input" />
          </div>
        </div>
      </div>

      {/* CARD 3: Club Specifics */}
      <div className="sec-card">
        <div className="sec-label">Club Specifics</div>

        <div className="fgrid" style={{ marginBottom: 24 }}>
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

        <div className="hrs-list">
          {DAYS.map((day, i) => (
            <div key={day} className={'hrs-row' + (errors['hours_' + day] ? ' row-err' : '')}>
              <span className="hrs-day-label">{DAY_LABELS[i]}</span>
              <div className="hrs-pickers">
                <TimePicker
                  value={form['hours_' + day + '_open']}
                  onChange={v => setField('hours_' + day + '_open', v)}
                  placeholder="Open"
                  defaultPeriod="AM"
                />
                <span className="hrs-dash">–</span>
                <TimePicker
                  value={form['hours_' + day + '_close']}
                  onChange={v => setField('hours_' + day + '_close', v)}
                  placeholder="Close"
                  defaultPeriod="PM"
                />
              </div>
              <button className="copy-hours-btn" title="Copy to other days"
                disabled={!form['hours_' + day + '_open'] || !form['hours_' + day + '_close']}
                onClick={() => { setCopySource(day); setCopyTargets({}) }}>⇢</button>
            </div>
          ))}
        </div>

        {copySource && (
          <div className="copy-panel">
            <div className="copy-panel-title">
              Copy {DAY_LABELS[DAYS.indexOf(copySource)]} hours to:
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

        {/* Social media + Website (website moved here) */}
        <div className="sec-sublabel" style={{ marginTop: 24 }}>Social media &amp; website <span className="optional-tag">all optional</span></div>
        {[
          { key: 'website',          label: 'Website',   placeholder: 'yoursite.com' },
          { key: 'social_facebook',  label: 'Facebook',  placeholder: 'facebook.com/yourpage' },
          { key: 'social_instagram', label: 'Instagram', placeholder: '@yourhandle' },
          { key: 'social_tiktok',    label: 'TikTok',    placeholder: '@yourhandle' },
          { key: 'social_youtube',   label: 'YouTube',   placeholder: 'youtube.com/yourchannel' },
        ].map(({ key, label, placeholder }) => (
          <div className="soc-row" key={key}>
            <span className="soc-lbl">{label}</span>
            <div className="pf"><input type="text" value={form[key]}
              onChange={e => setField(key, e.target.value)} placeholder={placeholder} /></div>
          </div>
        ))}
      </div>

      {/* CARD 4: Photos */}
      <div className="sec-card">
        <div className="sec-label">Club Photos <span className="optional-tag">optional</span></div>
        <div className="photo-section">
          <div className="photo-section-title">Club Logo</div>
          <div className="logo-upload-row">
            {logoUrl
              ? <div className="logo-preview"><img src={logoUrl} alt="Club logo" /><button className="photo-remove-btn" onClick={() => setLogoUrl(null)}>✕</button></div>
              : <div className="upload-placeholder logo-placeholder"><span>No logo yet</span></div>
            }
            <div>
              <button className="upload-btn" onClick={() => logoInputRef.current && logoInputRef.current.click()} disabled={uploadingLogo}>
                {uploadingLogo ? 'Uploading…' : logoUrl ? '↑ Replace Logo' : '↑ Upload Logo'}
              </button>
              <p className="upload-hint">PNG or JPG, square preferred</p>
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        <div className="photo-section" style={{ marginTop: 20 }}>
          <div className="photo-section-title">Club Photos</div>
          <p className="upload-hint" style={{ marginBottom: 12 }}>Up to 10 photos. Drag to reorder — first photo is your cover.</p>
          <div className="photos-grid">
            {photoUrls.map((url, i) => (
              <div
                key={url}
                className={`photo-thumb ${dragIdx.current === i ? 'dragging' : ''}`}
                draggable
                onDragStart={() => { dragIdx.current = i }}
                onDragOver={e => { e.preventDefault() }}
                onDrop={() => {
                  if (dragIdx.current === null || dragIdx.current === i) return
                  const newUrls = [...photoUrls]
                  const [moved] = newUrls.splice(dragIdx.current, 1)
                  newUrls.splice(i, 0, moved)
                  setPhotoUrls(newUrls)
                  dragIdx.current = null
                }}
                onDragEnd={() => { dragIdx.current = null }}
              >
                <img src={url} alt={'Club photo ' + (i+1)} />
                {i === 0 && <span className="photo-cover-badge">Cover</span>}
                <span className="photo-drag-handle">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="3" cy="3" r="1.2" fill="white"/><circle cx="3" cy="6" r="1.2" fill="white"/><circle cx="3" cy="9" r="1.2" fill="white"/>
                    <circle cx="9" cy="3" r="1.2" fill="white"/><circle cx="9" cy="6" r="1.2" fill="white"/><circle cx="9" cy="9" r="1.2" fill="white"/>
                  </svg>
                </span>
                <button className="photo-remove-btn" onClick={() => setPhotoUrls(p => p.filter((_, idx) => idx !== i))}>✕</button>
              </div>
            ))}
            {photoUrls.length < 10 && (
              <button className="photo-add-tile" onClick={() => photoInputRef.current && photoInputRef.current.click()} disabled={uploadingPhoto}>
                {uploadingPhoto ? '…' : '+'}
              </button>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onSave={saveCroppedPhoto}
          onCancel={() => { setCropSrc(null); setCropTarget(null) }}
        />
      )}

      {/* CARD 5: Herbalife Level */}
      <div className="sec-card">
        <div className="sec-label">Herbalife Level <span className="req-star">*</span></div>
        <p className="upload-hint" style={{ marginBottom: 14 }}>Select your current level in the Herbalife sales &amp; marketing plan.</p>

        <div style={{ position: 'relative' }}>
          {/* Locked overlay */}
          {lvlConfirmed && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.55)',
              borderRadius: 8, zIndex: 2, pointerEvents: 'none'
            }} />
          )}

          {/* Future Tab Team */}
          <div className="lvl-group-label">Future Tab Team</div>
          <div className="lvl-btn-row">
            {[
              { val: 'Distributor',       label: 'DS',  c: '#e3e3e3', cd: '#555' },
              { val: 'Success Builder',   label: 'SB',  c: '#e3e3e3', cd: '#555' },
              { val: 'Supervisor',        label: 'SP',  c: '#64ba44', cd: '#2a6b1a' },
              { val: 'World Team',        label: 'WT',  c: '#767678', cd: '#3a3a3a' },
              { val: 'Active World Team', label: 'AWT', c: '#767678', cd: '#3a3a3a' },
            ].map(({ val, label, c, cd }) => (
              <button key={val} type="button"
                className={`lvl-btn ${lvlTier === val ? 'on' : ''}`}
                style={{ '--lvlc': c, '--lvlcd': cd }}
                onClick={() => pickLvlTier(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Future Pres Team */}
          <div className="lvl-group-label" style={{ marginTop: 12 }}>Future Pres Team 🚀</div>
          <div className="lvl-btn-row">
            {[
              { val: 'Get Team',              label: 'GT', c: '#e02054', cd: '#8a0020' },
              { val: 'Get Team 2500',         label: 'GP', c: '#f39519', cd: '#7a4200' },
              { val: 'Millionaire Team',      label: 'MT', c: '#3aac77', cd: '#0c5a32' },
              { val: 'Millionaire Team 7500', label: 'MP', c: '#84c8d3', cd: '#1a5a60' },
            ].map(({ val, label, c, cd }) => (
              <button key={val} type="button"
                className={`lvl-btn ${lvlTier === val ? 'on' : ''}`}
                style={{ '--lvlc': c, '--lvlcd': cd }}
                onClick={() => pickLvlTier(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Pres Team */}
          <div className="lvl-group-label" style={{ marginTop: 12 }}>Pres Team 💎</div>
          <div className="lvl-btn-row">
            <button type="button"
              className={`lvl-btn ${lvlTier === 'PT' ? 'on' : ''}`}
              style={{ '--lvlc': '#fde488', '--lvlcd': '#7a5200' }}
              onClick={() => pickLvlTier('PT')}>
              PT
            </button>
          </div>

          {/* Chairman's & Founders */}
          <div className="lvl-group-label" style={{ marginTop: 12 }}>Chairman's &amp; Founders 🥈✦</div>
          <div className="lvl-btn-row">
            <button type="button"
              className={`lvl-btn lvl-btn-cc ${lvlTier === 'FCCC' ? 'on' : ''}`}
              onClick={() => pickLvlTier('FCCC')}>
              CC / FC
            </button>
          </div>

          {/* PT K level */}
          {lvlTier === 'PT' && (
            <div className="lvl-diamond-wrap" style={{ marginTop: 10 }}>
              <div className="lvl-diamond-label">K level — required</div>
              <div className="lvl-btn-row">
                {K_LEVELS.map(k => (
                  <button key={k} type="button"
                    className={`lvl-dia-btn ${lvlK === k ? 'on' : ''}`}
                    onClick={() => { setLvlK(k); setLvlDia(''); setLvlConfirmed(false); setField('herbalife_level', '') }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PT Diamonds — optional */}
          {lvlTier === 'PT' && lvlK && (
            <div className="lvl-diamond-wrap" style={{ marginTop: 8 }}>
              <div className="lvl-diamond-label">Diamonds — optional</div>
              <div className="lvl-btn-row">
                {['1','2','3','4'].map(d => (
                  <button key={d} type="button"
                    className={`lvl-dia-btn ${lvlDia === d ? 'on' : ''}`}
                    onClick={() => { setLvlDia(lvlDia === d ? '' : d); setLvlConfirmed(false); setField('herbalife_level', '') }}>
                    {d} <span style={{ fontSize: 11 }}>💎</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FCCC K level */}
          {lvlTier === 'FCCC' && (
            <div className="lvl-diamond-wrap lvl-diamond-wrap--cc" style={{ marginTop: 10 }}>
              <div className="lvl-diamond-label" style={{ color: '#5a5a72' }}>K level — required</div>
              <div className="lvl-btn-row">
                {CC_K_LEVELS.map(k => (
                  <button key={k} type="button"
                    className={`lvl-dia-btn lvl-dia-btn--cc ${lvlK === k ? 'on' : ''}`}
                    onClick={() => { setLvlK(k); setLvlDia(''); setLvlConfirmed(false); setField('herbalife_level', '') }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FCCC Diamonds — required */}
          {lvlTier === 'FCCC' && lvlK && (
            <div className="lvl-diamond-wrap lvl-diamond-wrap--cc" style={{ marginTop: 8 }}>
              <div className="lvl-diamond-label" style={{ color: '#5a5a72' }}>Diamonds — required (5–15)</div>
              <div className="lvl-btn-row">
                {['5','6','7','8','9','10','11','12','13','14','15'].map(d => (
                  <button key={d} type="button"
                    className={`lvl-dia-btn lvl-dia-btn--cc ${lvlDia === d ? 'on' : ''}`}
                    onClick={() => { setLvlDia(d); setLvlConfirmed(false); setField('herbalife_level', '') }}>
                    {d} <span style={{ fontSize: 11 }}>💎</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm button — appears when complete, not yet confirmed */}
        {lvlIsComplete() && !lvlConfirmed && (
          <button className="lvl-confirm-btn" onClick={confirmLevel}>
            Confirm level: {buildLvlDisplay(buildLvlValue()).replace(/ (\d+) 💎$/, '')}
            {buildLvlValue().includes(' 💎') && <> {buildLvlValue().match(/ (\d+) 💎$/)?.[1]} <span style={{ fontSize: 11 }}>💎</span></>}
          </button>
        )}

        {/* Locked confirmed state */}
        {lvlConfirmed && (
          <div className="lvl-locked-state">
            <div className="lvl-locked-check">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 6.5l3.5 3.5 5.5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="lvl-locked-text">
              Level confirmed:{' '}
              <strong>
                {form.herbalife_level.includes(' 💎')
                  ? <>{form.herbalife_level.replace(/ (\d+) 💎$/, (_, d) => ` ${d} `)}<span style={{ fontSize: 11 }}>💎</span></>
                  : form.herbalife_level
                }
              </strong>
            </div>
            <button className="lvl-change-btn" onClick={changeLevel}>Change</button>
          </div>
        )}

        {errors.herbalife_level && <span className="field-err">{errors.herbalife_level}</span>}
      </div>

      {/* CARD 6: Your Story */}
      <div className="sec-card">
        <div className="sec-label">Your Story <span className="optional-tag">all optional</span></div>
        <p className="story-intro">Share a little about yourself and your club. These may be shown on your club's profile page.</p>
        {[
          { key: 'story_why',               label: 'Why did you decide to open your club?' },
          { key: 'story_favorite_part',     label: 'What is your favorite part of club ownership?' },
          { key: 'story_before',            label: 'What did you do for work (your former occupation) before owning your club?' },
          { key: 'story_goal',              label: 'What is your next big goal in Herbalife?' },
          { key: 'story_favorite_products', label: 'What are your favorite products?' },
          { key: 'story_unique',            label: 'What is something unique and interesting about yourself?' },
        ].map(({ key, label }) => (
          <div className="pf story-field" key={key}>
            <label>{label}</label>
            <textarea rows={3} value={form[key]} onChange={e => setField(key, e.target.value)}
              placeholder="Share your answer here…" />
          </div>
        ))}
      </div>

      {/* CARD 7: Member Survey */}
      {(() => {
        const MONTHS_S = ['January','February','March','April','May','June','July','August','September','October','November','December']
        const YEARS_S  = Array.from({length: new Date().getFullYear() - 1979}, (_,i) => String(new Date().getFullYear()-i))
        const surveyComplete = !!(
          form.survey_upline && form.survey_hl_year &&
          form.survey_active_club !== null && form.survey_active_club !== '' &&
          (form.survey_active_club === false || form.survey_active_club === 'false' || form.survey_club_year) &&
          form.survey_trainings && form.survey_hear_how && form.survey_goal
        )
        const toggleSurveyTraining = (val) => {
          const current = form.survey_trainings ? form.survey_trainings.split(',').filter(Boolean) : []
          const set = new Set(current)
          if (val === 'all') { if (set.has('all')) set.clear(); else { set.clear(); set.add('all') } }
          else { set.delete('all'); if (set.has(val)) set.delete(val); else set.add(val) }
          setField('survey_trainings', [...set].join(','))
        }
        const tSet = new Set((form.survey_trainings || '').split(',').filter(Boolean))
        const isActiveClub = form.survey_active_club === true || form.survey_active_club === 'true'

        return (
          <div className="sec-card">
            <div className="sec-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Member Survey
              {!surveyComplete && <span className="survey-incomplete-badge">Incomplete</span>}
            </div>
            <p className="upload-hint" style={{ marginBottom: 14 }}>
              Help us get to know you better. All questions are optional but appreciated.
            </p>

            <div className="pf story-field">
              <label>Who is your upline or sponsor?</label>
              <input type="text" value={form.survey_upline || ''} onChange={e => setField('survey_upline', e.target.value)} placeholder="Full name" />
            </div>

            <div className="pf story-field">
              <label>How long have you been a Herbalife member?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.survey_hl_month || ''} onChange={e => setField('survey_hl_month', e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                  <option value="">Month (optional)</option>
                  {MONTHS_S.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={form.survey_hl_year || ''} onChange={e => setField('survey_hl_year', e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                  <option value="">Year</option>
                  {YEARS_S.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="pf story-field">
              <label>Are you actively operating a nutrition club?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button"
                  style={{ flex: 1, padding: '9px', border: `1px solid ${isActiveClub ? '#4CAF82' : '#c8d4cc'}`,
                    borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    background: isActiveClub ? '#E1F5EE' : 'transparent', color: isActiveClub ? '#0F6E56' : '#555' }}
                  onClick={() => setField('survey_active_club', true)}>
                  Yes
                </button>
                <button type="button"
                  style={{ flex: 1, padding: '9px', border: `1px solid ${form.survey_active_club === false || form.survey_active_club === 'false' ? '#E24B4A' : '#c8d4cc'}`,
                    borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    background: form.survey_active_club === false || form.survey_active_club === 'false' ? '#FCEBEB' : 'transparent',
                    color: form.survey_active_club === false || form.survey_active_club === 'false' ? '#A32D2D' : '#555' }}
                  onClick={() => setField('survey_active_club', false)}>
                  No
                </button>
              </div>
            </div>

            {isActiveClub && (
              <div className="pf story-field">
                <label>How long have you been operating your club?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={form.survey_club_month || ''} onChange={e => setField('survey_club_month', e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                    <option value="">Month (optional)</option>
                    {MONTHS_S.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                  <select value={form.survey_club_year || ''} onChange={e => setField('survey_club_year', e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                    <option value="">Year</option>
                    {YEARS_S.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="pf story-field">
              <label>Do you actively attend trainings and events?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  ['local',    'Local events and trainings (quickstarts, distributor workshops, etc.)'],
                  ['zoom',     'Team Zoom calls'],
                  ['sts',      'STS (Success Training Seminar)'],
                  ['regional', 'Regional quarterly events (LDW/FSL, BAE, Amplify/Elevate, etc.)'],
                  ['extrav',   'Extravaganza'],
                  ['all',      'All of the above'],
                ].map(([val, lbl]) => (
                  <div key={val}
                    onClick={() => toggleSurveyTraining(val)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px',
                      border: `1px solid ${tSet.has(val) ? '#4CAF82' : '#c8d4cc'}`,
                      borderRadius: 8, cursor: 'pointer',
                      background: tSet.has(val) ? '#f5fdf8' : 'transparent' }}>
                    <div style={{ width: 16, height: 16, border: `1.5px solid ${tSet.has(val) ? '#4CAF82' : '#c8d4cc'}`,
                      borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: tSet.has(val) ? '#4CAF82' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tSet.has(val) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, lineHeight: 1.4 }}>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pf story-field">
              <label>How did you hear about this platform?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  ['upline',    'A team member or my upline told me',  false],
                  ['clubowner', 'A fellow club owner shared it',        false],
                  ['zoom',      'Heard about it on a Zoom call',        false],
                  ['event',     'Heard about it at an event',           false],
                  ['other',     'Other',                                true],
                ].map(([val, lbl, hasInput]) => (
                  <div key={val}>
                    <div onClick={() => { setField('survey_hear_how', val); setField('survey_hear_detail', '') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                        border: `1px solid ${form.survey_hear_how === val ? '#4CAF82' : '#c8d4cc'}`,
                        borderRadius: form.survey_hear_how === val && hasInput ? '8px 8px 0 0' : 8,
                        cursor: 'pointer', background: form.survey_hear_how === val ? '#f5fdf8' : 'transparent' }}>
                      <div style={{ width: 16, height: 16, border: `1.5px solid ${form.survey_hear_how === val ? '#4CAF82' : '#c8d4cc'}`,
                        borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {form.survey_hear_how === val && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF82' }} />}
                      </div>
                      <span style={{ fontSize: 13 }}>{lbl}</span>
                    </div>
                    {hasInput && form.survey_hear_how === val && (
                      <div style={{ border: '1px solid #4CAF82', borderTop: 'none', borderRadius: '0 0 8px 8px',
                        background: '#f5fdf8', padding: '8px 12px' }}>
                        <input type="text" value={form.survey_hear_detail || ''}
                          onChange={e => setField('survey_hear_detail', e.target.value)}
                          placeholder="Please share a few details…"
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid #c8d4cc',
                            borderRadius: 6, fontSize: 13 }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pf story-field">
              <label>What is your primary goal for joining this platform?</label>
              <textarea rows={3} value={form.survey_goal || ''} onChange={e => setField('survey_goal', e.target.value)}
                placeholder="Share your thoughts…" />
            </div>
          </div>
        )
      })()}

      {/* Sticky Save Bar — always shown for new profiles, only shown when dirty for existing */}
      {(isDirty || savedFormRef.current === null) && (
        <div className={`save-bar save-bar--sticky ${isDirty && savedFormRef.current !== null ? 'save-bar--dirty' : ''}`}>
          {isDirty && savedFormRef.current !== null && (
            <div className="save-bar-alert">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#B45309" strokeWidth="1.5"/>
                <path d="M8 5v4" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.75" fill="#B45309"/>
              </svg>
              Unsaved changes
            </div>
          )}
          <div className="save-bar-btns">
            <button className="btn-save" onClick={() => handleSave('save')} disabled={saving && saveAction === 'save'}>
              {saving && saveAction === 'save' ? 'Saving…' : 'Save My Profile'}
            </button>
            <button className="btn-save-map" onClick={() => handleSave('map')} disabled={saving && saveAction === 'map'}>
              {saving && saveAction === 'map' ? 'Saving…' : 'Save & Return to Map'}
            </button>
          </div>
        </div>
      )}

      {/* Spacer so last card clears the sticky bar */}
      <div style={{ height: 88 }} />

      <div className="profile-privacy-link">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy & Use Policy</a>
      </div>

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  )
}
