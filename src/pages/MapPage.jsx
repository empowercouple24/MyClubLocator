import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import { divIcon, tooltip as leafletTooltip, marker as leafletMarker } from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import DemographicsPanel from '../components/DemographicsPanel'
import MapSearchAutocomplete from '../components/MapSearchAutocomplete'
import PhotoGallery from '../components/PhotoGallery'

// ── Circle markers via DivIcon ────────────────────────────
// own = warm red with ambient pulse, other = periwinkle blue, selected = gold with big pulse
// colors can be overridden via the colors param
function darken(hex) {
  // Simple darkening — multiply each channel by 0.7
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  const d = v => Math.max(0,Math.floor(v*0.65)).toString(16).padStart(2,'0')
  return `#${d(r)}${d(g)}${d(b)}`
}

function makeCircleIcon(type, colors = {}) {
  const defaults = {
    own:      { fill: '#D94F4F', size: 22 },
    other:    { fill: '#6B8DD6', size: 18 },
    selected: { fill: '#F59E0B', size: 26 },
    team:     { fill: '#7C3AED', size: 20 },
  }
  const fill = colors[type] || defaults[type].fill
  const size = defaults[type].size
  const r    = size / 2

  if (type === 'selected') {
    const html = `
      <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">
        <div class="marker-pulse-ring marker-pulse-ring--1" style="--pulse-color:${fill};"></div>
        <div class="marker-pulse-ring marker-pulse-ring--2" style="--pulse-color:${fill};"></div>
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2;">
          <circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${fill}" stroke="white" stroke-width="2.5"/>
        </svg>
      </div>`
    return divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [r, r], popupAnchor: [0, -r] })
  }

  if (type === 'own') {
    const html = `
      <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">
        <div class="marker-own-pulse" style="--pulse-color:${fill};"></div>
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2;">
          <circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${fill}" stroke="white" stroke-width="2"/>
        </svg>
      </div>`
    return divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [r, r], popupAnchor: [0, -r] })
  }

  if (type === 'team') {
    const html = `
      <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">
        <div class="marker-own-pulse" style="--pulse-color:${fill};"></div>
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2;">
          <circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${fill}" stroke="white" stroke-width="2"/>
        </svg>
      </div>`
    return divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [r, r], popupAnchor: [0, -r] })
  }

  // other
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${r}" cy="${r}" r="${r - 1.5}" fill="${fill}" stroke="white" stroke-width="2"/></svg>`
  return divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;cursor:pointer;transform:translate(-50%,-50%);">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [r, r],
    popupAnchor: [0, -r],
  })
}

// Icons cached per color signature — bust cache when colors change
let _iconCache = {}
function getIcons(colors = {}) {
  const sig = JSON.stringify(colors)
  if (!_iconCache[sig]) {
    _iconCache[sig] = {
      ownIcon:      makeCircleIcon('own',      colors),
      otherIcon:    makeCircleIcon('other',    colors),
      selectedIcon: makeCircleIcon('selected', colors),
      teamIcon:     makeCircleIcon('team',     colors),
    }
  }
  return _iconCache[sig]
}

const BASE_MAPS = [
  { id: 'mapbox',    label: 'Mapbox',        url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`, attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { id: 'carto',     label: 'OpenStreetMap', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  { id: 'satellite', label: 'Aerial',        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
]

const RADIUS_PRESETS = [3, 10, 20, 30]
const PANEL_POSITIONS = ['right', 'left']

function milesToMeters(m) { return m * 1609.34 }

function formatPhone(raw) {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return raw
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

function getDistanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function formatHoursDisplay(loc) {
  const days   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const fmt = t => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h < 12 ? 'AM' : 'PM'
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${hour}:${String(m).padStart(2,'0')} ${period}`
  }

  // Build open-day objects with index for consecutive detection
  const openDays = days.map((d, i) => ({
    idx: i, label: labels[i],
    o: loc[`hours_${d}_open`] || '',
    c: loc[`hours_${d}_close`] || '',
    open: !!(loc[`hours_${d}_open`] && loc[`hours_${d}_close`])
  })).filter(d => d.open)

  if (openDays.length === 0) return []

  // Group consecutive days with identical hours
  const ranges = []
  let run = [openDays[0]]
  for (let i = 1; i < openDays.length; i++) {
    const prev = run[run.length - 1], curr = openDays[i]
    if (curr.idx === prev.idx + 1 && curr.o === prev.o && curr.c === prev.c) {
      run.push(curr)
    } else {
      ranges.push(run); run = [curr]
    }
  }
  ranges.push(run)

  return ranges.map(r => {
    const label = r.length === 1 ? r[0].label : `${r[0].label}–${r[r.length-1].label}`
    return { day: label, hours: `${fmt(r[0].o)} – ${fmt(r[0].c)}` }
  })
}

function MapClickHandler({ onMapClick, active }) {
  const map = useMap()
  useEffect(() => {
    if (!active) return
    function handler(e) { onMapClick(e.latlng.lat, e.latlng.lng) }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [active, map])
  return null
}

function MapController({ center, zoom, panelPosition }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      const t = setTimeout(() => {
        if (!map._container) return
        map.invalidateSize()
        map.setView(center, zoom || map.getZoom(), { animate: true })
      }, 320)
      return () => clearTimeout(t)
    }
  }, [center, zoom])
  useEffect(() => {
    const t = setTimeout(() => {
      if (!map._container) return
      map.invalidateSize()
    }, 320)
    return () => clearTimeout(t)
  }, [panelPosition])
  return null
}

function MapRefCapture({ mapRef }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map])
  return null
}

function ScrollZoomController({ enabled }) {
  const map = useMap()
  useEffect(() => {
    if (enabled) { map.scrollWheelZoom.enable() }
    else { map.scrollWheelZoom.disable() }
  }, [map, enabled])
  return null
}

function ClubMarkers({ locations, selectedId, userId, onSelect, navigate, teamFilter, teamLocationIds, markerColors }) {
  const map = useMap()
  const markersRef = useRef({})

  useEffect(() => {
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}
    const { ownIcon, otherIcon, selectedIcon, teamIcon } = getIcons(markerColors || {})

    locations.forEach(loc => {
      const isOwn      = loc.user_id === userId
      const isSelected = loc.id === selectedId
      const isTeam     = teamFilter && teamLocationIds?.has(loc.id)
      const icon = isSelected ? selectedIcon : (isOwn ? ownIcon : (isTeam ? teamIcon : otherIcon))

      // ── Owner rows with photo or initials + per-owner level pill ──
      // ── Level condensing helper — produces "PT 30K 2💎", "MT", "CC 7💎" etc ──
      const condenseLvl = (l) => {
        if (!l) return ''
        return l
          .replace('Presidents Team', 'PT').replace('Chairmans Club', 'CC')
          .replace('Founders Circle', 'FC').replace('Millionaire Team 7500', 'MP')
          .replace('Millionaire Team', 'MT').replace('Get Team 2500', 'GP')
          .replace('Get Team', 'GT').replace('Active World Team', 'AWT')
          .replace('World Team', 'WT').replace('Supervisor', 'SP')
          .replace('Success Builder', 'SB').replace('Distributor', 'DS')
          .replace(/ (\d+) 💎$/, ' $1 💎')
      }

      const ownerRows = [
        { name: [loc.first_name, loc.last_name].filter(Boolean).join(' '), photo: loc.owner_photo_url, level: loc.herbalife_level },
        { name: [loc.owner2_first_name, loc.owner2_last_name].filter(Boolean).join(' '), photo: loc.owner2_photo_url, level: loc.owner2_herbalife_level },
        { name: [loc.owner3_first_name, loc.owner3_last_name].filter(Boolean).join(' '), photo: loc.owner3_photo_url, level: loc.owner3_herbalife_level },
      ].filter(o => o.name)

      const ownerHtml = ownerRows.map(o => {
        const initials = o.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
        const avatar = o.photo
          ? `<img src="${o.photo}" class="ct-owner-photo" alt="${o.name}" />`
          : `<div class="ct-owner-initials">${initials}</div>`
        const lvlLabel = condenseLvl(o.level)
        const pill = lvlLabel ? `<span class="ct-level-pill">${lvlLabel}</span>` : ''
        return `<div class="ct-owner-row">${avatar}<span class="ct-owner-name">${o.name}</span>${pill}</div>`
      }).join('')

      // ── Logo or initials ──
      const logoHtml = loc.logo_url
        ? `<img src="${loc.logo_url}" class="ct-logo-img" alt="logo" />`
        : `<div class="ct-logo-initials">${(loc.club_name || 'CL').slice(0,2).toUpperCase()}</div>`

      // ── Level pill ──
      const levelLabel = condenseLvl(loc.herbalife_level)
      const levelHtml = levelLabel
        ? `<div class="ct-level-pill">${levelLabel}</div>`
        : ''

      // ── Address ──
      const addrParts = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean)
      const addrHtml = addrParts.length
        ? `<div class="ct-addr">${addrParts.join(', ')}</div>`
        : ''

      // ── Condensed hours ──
      const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      const formatT = t => {
        if (!t) return ''
        const [h, m] = t.split(':').map(Number)
        const p = h < 12 ? 'AM' : 'PM'
        const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
        return `${hr}:${String(m).padStart(2,'0')} ${p}`
      }
      const openDays = DAYS.map((d,i) => ({
        label: DAY_LABELS[i], open: !!(loc[`hours_${d}_open`] && loc[`hours_${d}_close`]),
        o: loc[`hours_${d}_open`] || '', c: loc[`hours_${d}_close`] || ''
      })).filter(d => d.open)

      let hoursHtml = ''
      if (openDays.length) {
        const ranges = []
        let run = [openDays[0]]
        for (let i = 1; i < openDays.length; i++) {
          const prev = run[run.length-1], curr = openDays[i]
          const prevIdx = DAYS.indexOf(DAYS.find((_,j) => DAY_LABELS[j] === prev.label))
          const currIdx = DAYS.indexOf(DAYS.find((_,j) => DAY_LABELS[j] === curr.label))
          if (currIdx === prevIdx + 1 && prev.o === curr.o && prev.c === curr.c) run.push(curr)
          else { ranges.push(run); run = [curr] }
        }
        ranges.push(run)
        const hoursLines = ranges.map(r => {
          const lbl = r.length === 1 ? r[0].label : `${r[0].label}–${r[r.length-1].label}`
          return `<div class="ct-hours-row"><span class="ct-hours-day">${lbl}</span><span class="ct-hours-time">${formatT(r[0].o)} – ${formatT(r[0].c)}</span></div>`
        }).join('')
        hoursHtml = `<div class="ct-hours-block">${hoursLines}</div>`
      }

      // ── Open since ──
      const sinceHtml = loc.opened_month && loc.opened_year
        ? `<div class="ct-since">Club open since ${loc.opened_month} ${loc.opened_year}</div>` : ''

      // ── Directory link ──
      const dirLink = `<div class="ct-dir-link" data-clubname="${encodeURIComponent(loc.club_name || '')}">View in directory →</div>`

      const tooltipHtml = `
        <div class="ct-inner">
          <div class="ct-header">
            ${logoHtml}
            <div class="ct-header-text">
              <div class="ct-name">${loc.club_name || 'Unnamed Club'}</div>
              ${addrHtml}
            </div>
          </div>
          ${ownerHtml}
          ${hoursHtml}
          ${sinceHtml}
          ${dirLink}
        </div>`

      const tooltip = leafletTooltip({
        permanent: false,
        direction: 'top',
        offset: [0, -28],
        className: 'club-tooltip',
        sticky: false,
      }).setContent(tooltipHtml)

      let closeTimer = null

      const openTooltip = () => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
        marker.openTooltip()
      }
      const scheduleClose = () => {
        if (closeTimer) clearTimeout(closeTimer)
        closeTimer = setTimeout(() => { marker.closeTooltip() }, 3000)
      }
      const cancelClose = () => {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
      }

      const marker = leafletMarker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindTooltip(tooltip)
        .on('click', () => onSelect(loc))
        .on('mouseover', openTooltip)
        .on('mouseout', scheduleClose)
        .on('tooltipopen', (ev) => {
          // Attach hover + click listeners to the whole tooltip container
          setTimeout(() => {
            // ev.tooltip._container is the actual .leaflet-tooltip DOM node
            const tooltipEl = ev.tooltip && ev.tooltip._container
            if (tooltipEl) {
              tooltipEl.addEventListener('mouseenter', cancelClose)
              tooltipEl.addEventListener('mouseleave', scheduleClose)
              // Directory link click
              const el = tooltipEl.querySelector('.ct-dir-link')
              if (el) {
                el.addEventListener('click', (e) => {
                  e.stopPropagation()
                  const name = decodeURIComponent(el.dataset.clubname || '')
                  navigate(`/app/directory?search=${encodeURIComponent(name)}`)
                })
              }
            }
          }, 50)
        })

      markersRef.current[loc.id] = marker
    })

    return () => { Object.values(markersRef.current).forEach(m => m.remove()); markersRef.current = {} }
  }, [locations, selectedId, userId, teamFilter, teamLocationIds, markerColors])

  return null
}

// ── My Club pinned card ─────────────────────────────────────
function MyClubCard({ myClub, onManage }) {
  if (!myClub) {
    return (
      <div className="my-club-card my-club-empty">
        <div className="mcc-icon">📍</div>
        <div>
          <div className="mcc-name">Your Club</div>
          <button className="mcc-setup-btn" onClick={onManage}>Set up your club →</button>
        </div>
      </div>
    )
  }
  return (
    <div className="my-club-card">
      {myClub.logo_url
        ? <img src={myClub.logo_url} alt="logo" className="mcc-logo" />
        : <div className="mcc-initials">{(myClub.club_name || 'MC').slice(0,2).toUpperCase()}</div>
      }
      <div className="mcc-info">
        <div className="mcc-name">{myClub.club_name || 'Your Club'}</div>
        {myClub.city && <div className="mcc-loc">{myClub.city}{myClub.state ? `, ${myClub.state}` : ''}</div>}
        {myClub.opened_month && myClub.opened_year && (
          <div className="mcc-since">Since {myClub.opened_month} {myClub.opened_year}</div>
        )}
      </div>
      <button className="mcc-edit-btn" onClick={onManage} title="Manage my club">✏️</button>
    </div>
  )
}

// ── Club detail panel content ───────────────────────────────
function ClubDetail({ club, userId, panelWidth, onManage, radiusMiles, setRadiusMiles, customMiles, setCustomMiles, filteredCount, setGalleryPhotos, onExploreArea }) {
  const [photoPage, setPhotoPage] = useState(0)
  useEffect(() => { setPhotoPage(0) }, [club?.id])
  if (!club) {
    return (
      <div className="cp-empty">
        <div className="cp-empty-icon">🗺</div>
        <div className="cp-empty-text">Select a club on the map to view its details</div>
      </div>
    )
  }

  const isOwn = club.user_id === userId
  const hourRows = formatHoursDisplay(club)
  const ownerName = [club.first_name, club.last_name].filter(Boolean).join(' ')
  const owner2Name = [club.owner2_first_name, club.owner2_last_name].filter(Boolean).join(' ')
  const owner3Name = [club.owner3_first_name, club.owner3_last_name].filter(Boolean).join(' ')

  const owners = [
    { name: ownerName,  photo: club.owner_photo_url },
    { name: owner2Name, photo: club.owner2_photo_url },
    { name: owner3Name, photo: club.owner3_photo_url },
  ].filter(o => o.name)

  return (
    <>
      {/* Club header */}
      <div className="cp-header">
        <div className="cp-header-left">
          {club.logo_url
            ? <img src={club.logo_url} alt="logo" className="cp-logo" />
            : <div className="cp-initials">{(club.club_name || 'CL').slice(0,2).toUpperCase()}</div>
          }
          <div>
            <h2 className="cp-name">{club.club_name || 'Unnamed Club'}</h2>
            {club.city && <p className="cp-location">{club.city}{club.state ? `, ${club.state}` : ''}</p>}
            {club.opened_month && club.opened_year && (
              <p className="cp-since">Open since {club.opened_month} {club.opened_year}</p>
            )}
          </div>
        </div>
      </div>

      {/* Own club CTA */}
      {isOwn && (
        <button className="cp-manage-btn" onClick={onManage}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <span>
            <strong>Manage My Club</strong>
            <small>{club.club_name || 'Your Club'}</small>
          </span>
        </button>
      )}

      {/* Owners */}
      {owners.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-title">Owners</div>
          {owners.map((o, i) => (
            <div key={i} className="cp-row cp-owner-row">
              <div className="cp-owner-avatar">
                {o.photo
                  ? <img src={o.photo} alt={o.name} className="cp-owner-photo" />
                  : <span className="cp-icon">👤</span>
                }
              </div>
              <span>{o.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contact */}
      <div className="cp-section">
        <div className="cp-section-title">Contact</div>
        {club.address && <div className="cp-row"><span className="cp-icon">📍</span><span>{club.address}{club.city ? `, ${club.city}` : ''}</span></div>}
        {club.club_phone && <div className="cp-row"><span className="cp-icon">📞</span><span>{formatPhone(club.club_phone)}</span></div>}
        {club.club_email && <div className="cp-row"><span className="cp-icon">✉️</span><span className="cp-email-plain">{club.club_email}</span></div>}
        {club.website && <div className="cp-row"><span className="cp-icon">🌐</span><a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noreferrer">{club.website}</a></div>}
      </div>

      {/* Hours */}
      {hourRows.length > 0 && (
        <div className="cp-section">
          <div className="cp-section-title">Hours</div>
          <div className="cp-hours-grid">
            {hourRows.map(r => (
              <div key={r.day} className="cp-hours-row">
                <span className="cp-hours-day">{r.day}</span>
                <span className="cp-hours-time">{r.hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social */}
      {(club.social_facebook || club.social_instagram || club.social_tiktok || club.social_youtube) && (
        <div className="cp-section">
          <div className="cp-section-title">Social</div>
          <div className="cp-socials">
            {club.social_facebook  && <a href={club.social_facebook}  target="_blank" rel="noreferrer" className="cp-social-link">Facebook</a>}
            {club.social_instagram && <a href={club.social_instagram} target="_blank" rel="noreferrer" className="cp-social-link">Instagram</a>}
            {club.social_tiktok    && <a href={club.social_tiktok}    target="_blank" rel="noreferrer" className="cp-social-link">TikTok</a>}
            {club.social_youtube   && <a href={club.social_youtube}   target="_blank" rel="noreferrer" className="cp-social-link">YouTube</a>}
          </div>
        </div>
      )}

      {/* Photos — horizontal strip */}
      {(() => {
        const photos   = club.photo_urls || []
        const slots    = panelWidth === 'wide' ? 5 : 3
        const total    = photos.length
        const hasMore  = total > slots
        const pages    = hasMore ? Math.ceil(total / slots) : 1
        const safePage = Math.min(photoPage, pages - 1)
        const start    = safePage * slots
        const visible  = photos.slice(start, start + slots)
        const empties  = slots - visible.length

        return (
          <div className="cp-section">
            <div className="cp-section-title">Photos</div>
            <div className="cp-photo-strip">
              {visible.map((url, i) => (
                <div key={i} className="cp-photo-strip-tile cp-photo-strip-tile--real"
                  onClick={() => setGalleryPhotos({ photos, start: start + i })}>
                  <img src={url} alt={`Photo ${start + i + 1}`} />
                </div>
              ))}
              {Array.from({ length: empties }).map((_, i) => (
                <div key={`empty-${i}`} className="cp-photo-strip-tile cp-photo-strip-tile--empty">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="cp-photo-strip-footer">
                <div className="cp-photo-strip-dots">
                  {photos.map((_, i) => (
                    <div key={i} className={`cp-photo-strip-dot ${i >= start && i < start + slots ? 'on' : ''}`} />
                  ))}
                </div>
                <div className="cp-photo-strip-nav">
                  <button
                    className={`cp-photo-nav-btn ${safePage === 0 ? 'dim' : ''}`}
                    onClick={() => setPhotoPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                      <path d="M5 1L1 5l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Prev
                  </button>
                  <button
                    className={`cp-photo-nav-btn ${safePage >= pages - 1 ? 'dim' : ''}`}
                    onClick={() => setPhotoPage(p => Math.min(pages - 1, p + 1))}
                    disabled={safePage >= pages - 1}
                  >
                    Next
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Explore area button */}
      {club.lat && club.lng && onExploreArea && (
        <button className="cp-explore-btn" onClick={onExploreArea}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="2" fill="currentColor"/>
            <line x1="8" y1="1" x2="8" y2="3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="8" y1="12.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="1" y1="8" x2="3.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <line x1="12.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Explore Market Demographics Data →
        </button>
      )}

      {/* Radius */}
      <div className="cp-section cp-radius-section">
        <div className="cp-section-title">Nearby Clubs</div>
        <p className="cp-radius-hint">Show clubs within a radius of this location</p>
        <div className="radius-presets">
          {RADIUS_PRESETS.map(m => (
            <button key={m}
              className={`radius-preset-btn ${radiusMiles === m ? 'active' : ''}`}
              onClick={() => setRadiusMiles(radiusMiles === m ? null : m)}>
              {m} mi
            </button>
          ))}
        </div>
        <div className="radius-custom">
          <input type="number" min="0.5" max="50" step="0.5"
            placeholder="Custom mi" value={customMiles}
            onChange={e => setCustomMiles(e.target.value)} />
          <button className="radius-preset-btn"
            onClick={() => { if (customMiles) setRadiusMiles(parseFloat(customMiles)) }}
            disabled={!customMiles}>Apply</button>
        </div>
        {radiusMiles && (
          <div className="radius-result">{filteredCount} club{filteredCount !== 1 ? 's' : ''} within {radiusMiles} mi</div>
        )}
      </div>
    </>
  )
}

// ── Main MapPage ────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [galleryPhotos, setGalleryPhotos] = useState(null) // null = closed, array = open
  const [baseMap, setBaseMap]       = useState('mapbox')
  const [mapCenter, setMapCenter]   = useState(null)
  const [mapZoom, setMapZoom]       = useState(null)
  const [citySearch, setCitySearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [geocoding, setGeocoding]   = useState(false)
  const [radiusMiles, setRadiusMiles] = useState(null)
  const [customMiles, setCustomMiles] = useState('')
  const [saveViewToast, setSaveViewToast] = useState(false)
  const [myClubCollapsed, setMyClubCollapsed] = useState(true)
  const mapRef = useRef(null)
  const mapAreaRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 })

  // Demographics
  const [demoActive, setDemoActive]   = useState(false)
  const [demoLat, setDemoLat]         = useState(null)
  const [demoLng, setDemoLng]         = useState(null)
  const [scrollZoom, setScrollZoom]   = useState(() => {
    const saved = localStorage.getItem('mapScrollZoom')
    return saved === null ? true : saved === 'true'
  })
  const [geoLocating, setGeoLocating] = useState(false)   // spinner while fetching
  const [geoError, setGeoError]       = useState(null)    // error message
  const [geoMarker, setGeoMarker]     = useState(null)    // { lat, lng } or null
  const defaultEnabledFactors = {
    population: true, income: true, ageFit: true, medianAge: true,
    poverty: true, competition: true, health: true, spending: true,
    growth: true, commute: true, competitors: true,
  }
  const [enabledFactors, setEnabledFactors] = useState(defaultEnabledFactors)

  // Load admin-controlled demo factor toggles from app_settings
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
      if (!data) return
      setEnabledFactors({
        population:  data.demo_population  !== false,
        income:      data.demo_income      !== false,
        ageFit:      data.demo_age_fit     !== false,
        medianAge:   data.demo_median_age  !== false,
        poverty:     data.demo_poverty     !== false,
        competition: data.demo_competition !== false,
        health:      data.demo_health      !== false,
        spending:    data.demo_spending    !== false,
        growth:      data.demo_growth      !== false,
        commute:     data.demo_commute     !== false,
        competitors: data.demo_competitors !== false,
      })
      if (data.marker_color_own || data.marker_color_other || data.marker_color_selected || data.marker_color_team) {
        setMarkerColors({
          own:      data.marker_color_own      || '#D94F4F',
          other:    data.marker_color_other    || '#6B8DD6',
          selected: data.marker_color_selected || '#F59E0B',
          team:     data.marker_color_team     || '#7C3AED',
        })
      }
    }
    loadSettings()
  }, [])

  // Panel position — per user, stored in localStorage, default 'right'
  const posKey     = user ? `panel_position_${user.id}` : 'panel_position'
  const viewKey    = user ? `default_view_${user.id}`   : 'default_view'
  const [panelPosition, setPanelPosition] = useState(() => {
    return localStorage.getItem(posKey) || 'right'
  })
  const [panelWidth,     setPanelWidth]     = useState('normal')   // 'normal' | 'wide'
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [clickBehavior,  setClickBehavior]  = useState('zoom')     // 'zoom' | 'pan' | 'stay'
  const [teamFilter, setTeamFilter]           = useState(false)      // show my team clubs highlighted
  const [teamLocationIds, setTeamLocationIds] = useState(new Set()) // location IDs in my teams (owned)
  const [memberTeamLocationIds, setMemberTeamLocationIds] = useState(new Set()) // location IDs in teams I belong to
  const [isTeamOwner, setIsTeamOwner]         = useState(false)     // true if user owns at least one team
  const [isTeamMember, setIsTeamMember]       = useState(false)     // true if user belongs to a team (not as owner)
  const [visibilityMode, setVisibilityMode]   = useState('all')     // 'all' | 'mine' | 'team' | 'mine_team' | 'others' | 'none'
  const [markerColors, setMarkerColors]       = useState({
    own: '#D94F4F', other: '#6B8DD6', selected: '#F59E0B', team: '#7C3AED'
  })

  function updatePanelPosition(pos) {
    setPanelPosition(pos)
    localStorage.setItem(posKey, pos)
  }

  // Load panel width/collapsed prefs from user_demo_preferences
  useEffect(() => {
    if (!user) return
    async function loadPanelPrefs() {
      const { data } = await supabase
        .from('user_demo_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .single()
      if (data?.preferences?.panelWidth)     setPanelWidth(data.preferences.panelWidth)
      if (data?.preferences?.panelCollapsed !== undefined) setPanelCollapsed(data.preferences.panelCollapsed)
      if (data?.preferences?.clickBehavior)  setClickBehavior(data.preferences.clickBehavior)
    }
    loadPanelPrefs()
  }, [user])

  // Load team location IDs for the team filter
  useEffect(() => {
    if (!user) return
    async function loadTeamIds() {
      // Teams I own → all accepted member location IDs
      const { data: ownedTeams } = await supabase
        .from('teams')
        .select('team_members(location_id, status)')
        .eq('owner_user_id', user.id)

      const ownedIds = new Set()
      if (ownedTeams) {
        ownedTeams.forEach(t => t.team_members?.forEach(m => {
          if (m.status === 'accepted') ownedIds.add(m.location_id)
        }))
      }
      setTeamLocationIds(ownedIds)
      setIsTeamOwner(ownedTeams && ownedTeams.length > 0)

      // Teams I belong to as a member → find my location IDs first, then get sibling locations
      const myLocationIds = [] // will fill from locations after load, use a direct query instead
      const { data: myLocs } = await supabase
        .from('locations')
        .select('id')
        .eq('user_id', user.id)

      if (myLocs && myLocs.length > 0) {
        const myLocIds = myLocs.map(l => l.id)
        // Find teams where one of my locations is an accepted member
        const { data: memberRows } = await supabase
          .from('team_members')
          .select('team_id')
          .in('location_id', myLocIds)
          .eq('status', 'accepted')

        if (memberRows && memberRows.length > 0) {
          const myTeamIds = [...new Set(memberRows.map(r => r.team_id))]
          // Get all accepted members of those teams
          const { data: teammates } = await supabase
            .from('team_members')
            .select('location_id')
            .in('team_id', myTeamIds)
            .eq('status', 'accepted')
          const memberIds = new Set(teammates?.map(r => r.location_id) || [])
          setMemberTeamLocationIds(memberIds)
          setIsTeamMember(memberIds.size > 0)
        }
      }
    }
    loadTeamIds()
  }, [user])

  async function savePanelPrefs(width, collapsed) {
    if (!user) return
    const { data: existing } = await supabase
      .from('user_demo_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single()
    const merged = { ...(existing?.preferences || {}), panelWidth: width, panelCollapsed: collapsed }
    await supabase.from('user_demo_preferences')
      .upsert({ user_id: user.id, preferences: merged }, { onConflict: 'user_id' })
  }

  async function saveClickBehavior(behavior) {
    setClickBehavior(behavior)
    if (!user) return
    const { data: existing } = await supabase
      .from('user_demo_preferences')
      .select('preferences')
      .eq('user_id', user.id)
      .single()
    const merged = { ...(existing?.preferences || {}), clickBehavior: behavior }
    await supabase.from('user_demo_preferences')
      .upsert({ user_id: user.id, preferences: merged }, { onConflict: 'user_id' })
  }

  function togglePanelWidth() {
    const next = panelWidth === 'normal' ? 'wide' : 'normal'
    setPanelWidth(next)
    savePanelPrefs(next, panelCollapsed)
  }

  function togglePanelCollapsed() {
    const next = !panelCollapsed
    setPanelCollapsed(next)
    savePanelPrefs(panelWidth, next)
  }

  // Load saved default view on mount (after locations load)
  const defaultViewApplied = useRef(false)
  useEffect(() => {
    if (locations.length > 0 && !defaultViewApplied.current) {
      const saved = localStorage.getItem(viewKey)
      if (saved) {
        try {
          const { lat, lng, zoom } = JSON.parse(saved)
          setMapCenter([lat, lng])
          setMapZoom(zoom)
        } catch {}
      }
      defaultViewApplied.current = true
    }
  }, [locations])

  function saveDefaultView() {
    if (!mapRef.current) return
    const center = mapRef.current.getCenter()
    const zoom   = mapRef.current.getZoom()
    localStorage.setItem(viewKey, JSON.stringify({ lat: center.lat, lng: center.lng, zoom }))
    setSaveViewToast(true)
    setTimeout(() => setSaveViewToast(false), 2500)
  }

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('locations').select('*').not('lat', 'is', null).not('lng', 'is', null)
        .neq('approved', false)
      if (!error && data) setLocations(data)
      setLoading(false)
    }
    load()
    const channel = supabase.channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const myClub = locations.find(l => l.user_id === user?.id) || null

  // Zoom map to fit the radius circle whenever radiusMiles or selected changes
  useEffect(() => {
    if (!radiusMiles || !selected?.lat || !selected?.lng || !mapRef.current) return
    const radiusMeters = milesToMeters(radiusMiles)
    const latDelta = radiusMeters / 111320
    const lngDelta = radiusMeters / (111320 * Math.cos(selected.lat * Math.PI / 180))
    mapRef.current.fitBounds(
      [[selected.lat - latDelta, selected.lng - lngDelta],
       [selected.lat + latDelta, selected.lng + lngDelta]],
      { padding: [48, 48], animate: true, maxZoom: 14 }
    )
  }, [radiusMiles, selected])

  async function handleSelectClub(loc) {
    setSelected(loc)
    setRadiusMiles(null)
    setCustomMiles('')
    if (clickBehavior === 'zoom') {
      setMapCenter([loc.lat, loc.lng])
      setMapZoom(14)
    } else if (clickBehavior === 'pan') {
      setMapCenter([loc.lat, loc.lng])
      // no zoom change — MapController will pan without zooming
    }
    // 'stay' — do nothing to the map view
  }

  async function handleCitySearch(e) {
    e.preventDefault()
    if (!citySearch.trim()) { setCityFilter(''); return }
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(citySearch)}&limit=1`)
      const data = await res.json()
      if (data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)])
        setMapZoom(11)
      }
    } catch {}
    setCityFilter(citySearch)
    setGeocoding(false)
  }

  function clearFilters() {
    setCityFilter(''); setCitySearch('')
    setRadiusMiles(null); setCustomMiles('')
    setSelected(null)
  }

  function handleGeoLocate() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      setTimeout(() => setGeoError(null), 4000)
      return
    }
    // If already showing a marker, clicking again clears it
    if (geoMarker) {
      setGeoMarker(null)
      return
    }
    setGeoLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoMarker({ lat, lng })
        setMapCenter([lat, lng])
        setMapZoom(13)
        setGeoLocating(false)
      },
      err => {
        setGeoLocating(false)
        if (err.code === 1) {
          setGeoError('Location access denied. Enable it in your browser settings.')
        } else {
          setGeoError('Could not get your location. Try again.')
        }
        setTimeout(() => setGeoError(null), 5000)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Combined team set for legend/filter: owned teams + member teams
  const allTeamLocationIds = new Set([...teamLocationIds, ...memberTeamLocationIds])

  const filteredLocations = locations.filter(loc => {
    // Visibility mode filter
    const isOwn  = loc.user_id === user?.id
    const isTeam = allTeamLocationIds.has(loc.id)
    if (visibilityMode === 'none') return false
    if (visibilityMode === 'mine') return isOwn
    if (visibilityMode === 'team') return isTeam
    if (visibilityMode === 'mine_team') return isOwn || isTeam
    if (visibilityMode === 'others') return !isOwn
    // 'all' falls through

    // Radius filter
    if (selected && radiusMiles) {
      const dist = getDistanceMiles(selected.lat, selected.lng, loc.lat, loc.lng)
      if (dist > radiusMiles) return false
    }
    // City filter
    if (cityFilter) {
      const hay = `${loc.city||''} ${loc.state||''} ${loc.address||''}`.toLowerCase()
      return hay.includes(cityFilter.toLowerCase())
    }
    return true
  }).filter(loc => {
    // For modes other than 'all', still apply radius+city on top
    if (visibilityMode === 'none' || visibilityMode === 'all') return true
    if (selected && radiusMiles) {
      const dist = getDistanceMiles(selected.lat, selected.lng, loc.lat, loc.lng)
      if (dist > radiusMiles) return false
    }
    if (cityFilter) {
      const hay = `${loc.city||''} ${loc.state||''} ${loc.address||''}`.toLowerCase()
      return hay.includes(cityFilter.toLowerCase())
    }
    return true
  })

  const activeBase = BASE_MAPS.find(b => b.id === baseMap) || BASE_MAPS[0]
  const defaultCenter = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [39.5, -98.35]
  const hasFilter = cityFilter || radiusMiles || visibilityMode !== 'all'

  return (
    <div className={`map-wrapper map-pos-${panelPosition}`}>

      {/* ── Map area ── */}
      <div
        className={`map-area${demoActive ? ' demo-research-mode' : ''}`}
        ref={mapAreaRef}
        onMouseMove={e => {
          if (!demoActive) return
          const rect = e.currentTarget.getBoundingClientRect()
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }}
        onMouseLeave={() => setMousePos({ x: -999, y: -999 })}
      >
        {/* Pulsing target cursor overlay */}
        {demoActive && mousePos.x > 0 && (
          <div className="demo-cursor-pulse" style={{ left: mousePos.x, top: mousePos.y }}>
            <div className="demo-cursor-ring demo-cursor-ring--outer" />
            <div className="demo-cursor-ring demo-cursor-ring--inner" />
            <div className="demo-cursor-dot" />
          </div>
        )}

        {loading ? <div className="loading">Loading map…</div> : (
          <MapContainer center={defaultCenter} zoom={locations.length > 0 ? 11 : 5} style={{ height: '100%', width: '100%' }}>
            <MapRefCapture mapRef={mapRef} />
            <ScrollZoomController enabled={scrollZoom} />
            <MapController center={mapCenter} zoom={mapZoom} panelPosition={panelPosition} />
            <MapClickHandler active={demoActive} onMapClick={(lat, lng) => { setDemoLat(lat); setDemoLng(lng) }} />
            <TileLayer key={activeBase.id} attribution={activeBase.attribution} url={activeBase.url} />
            <ClubMarkers locations={filteredLocations} selectedId={selected?.id} userId={user?.id} onSelect={handleSelectClub} navigate={navigate} teamFilter={teamFilter} teamLocationIds={allTeamLocationIds} markerColors={markerColors} />
            {selected && radiusMiles && (
              <Circle center={[selected.lat, selected.lng]} radius={milesToMeters(radiusMiles)}
                pathOptions={{ color: '#1A3C2E', fillColor: '#4CAF82', fillOpacity: 0.08, weight: 2 }} />
            )}
            {geoMarker && (
              <Marker
                position={[geoMarker.lat, geoMarker.lng]}
                icon={divIcon({
                  className: '',
                  html: '<div class="geo-dot"><div class="geo-dot-inner"></div><div class="geo-dot-ring"></div></div>',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              />
            )}
          </MapContainer>
        )}

        {/* Search toolbar */}
        <div className="map-toolbar">
          <form className="map-search-form" onSubmit={handleCitySearch}>
            <MapSearchAutocomplete
              value={citySearch}
              onChange={setCitySearch}
              geocoding={geocoding}
              onSelect={({ lat, lng, label }) => {
                setMapCenter([lat, lng])
                setMapZoom(11)
                setCityFilter(label)
              }}
              onClear={clearFilters}
            />
          </form>
          {hasFilter && <button className="map-clear-btn" onClick={clearFilters}>✕ Clear</button>}
          <button
            className={`map-demo-btn ${demoActive ? 'active' : ''}`}
            onClick={() => {
              const next = !demoActive
              setDemoActive(next)
              if (next) {
                setMyClubCollapsed(true) // collapse My Club when entering research mode
                setDemoLat(null); setDemoLng(null)
              } else {
                setDemoLat(null); setDemoLng(null)
              }
            }}
            title="Toggle market data">
            📊 Market Data
          </button>
          <button
            className={`map-scroll-zoom-btn ${scrollZoom ? 'active' : ''}`}
            onClick={() => {
              const next = !scrollZoom
              setScrollZoom(next)
              localStorage.setItem('mapScrollZoom', String(next))
            }}
            title={scrollZoom ? 'Scroll zoom ON — click to disable' : 'Scroll zoom OFF — click to enable'}>
            🖱️ Scroll Zoom {scrollZoom ? 'On' : 'Off'}
          </button>
          <button
            className={`map-geolocate-btn${geoMarker ? ' active' : ''}${geoLocating ? ' loading' : ''}`}
            onClick={handleGeoLocate}
            title={geoMarker ? 'Clear my location' : 'Show my location on the map'}
            disabled={geoLocating}>
            {geoLocating
              ? <span className="geo-spinner" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" fill="currentColor"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                </svg>
            }
            {geoLocating ? ' Locating…' : geoMarker ? ' My Location ✓' : ' My Location'}
          </button>
          {!scrollZoom && (
            <div className="map-manual-zoom">
              <button className="map-zoom-btn" onClick={() => mapRef.current && mapRef.current.zoomIn()} title="Zoom in">+</button>
              <button className="map-zoom-btn" onClick={() => mapRef.current && mapRef.current.zoomOut()} title="Zoom out">−</button>
            </div>
          )}
        </div>

        {/* Base map + panel position toggles + default view */}
        <div className="map-controls-bottom">
          <div className="map-basemap-toggle">
            {BASE_MAPS.map(b => (
              <button key={b.id} className={`basemap-btn ${baseMap === b.id ? 'active' : ''}`} onClick={() => setBaseMap(b.id)}>{b.label}</button>
            ))}
          </div>
          {teamLocationIds.size > 0 && (
            <button
              className={`map-team-filter-btn ${teamFilter ? 'active' : ''}`}
              onClick={() => setTeamFilter(f => !f)}
              title={teamFilter ? 'Showing team clubs — click to clear' : 'Highlight my team clubs'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              My Team
              {teamFilter && <span className="map-team-count">{teamLocationIds.size}</span>}
            </button>
          )}
          <div className="map-click-behavior" title="What happens when you click a club marker">
            <span className="map-click-behavior-label">On click:</span>
            {[
              { val: 'zoom', label: 'Zoom in',  title: 'Fly to club and zoom in' },
              { val: 'pan',  label: 'Pan only', title: 'Center on club, keep current zoom' },
              { val: 'stay', label: 'Stay put', title: 'Open club in panel, map stays' },
            ].map(({ val, label, title }) => (
              <button
                key={val}
                className={`click-behavior-btn ${clickBehavior === val ? 'active' : ''}`}
                onClick={() => saveClickBehavior(val)}
                title={title}
              >{label}</button>
            ))}
          </div>
          <div className="map-controls-right">
            <button className="map-default-view-btn" onClick={saveDefaultView} title="Save current map view as default">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" fill="currentColor"/>
              </svg>
              Set Default View
            </button>
            <div className="map-position-toggle" title="Panel position">
              {[
                { pos: 'left',  icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.9"/><rect x="7" y="1" width="8" height="14" rx="1" fill="currentColor" opacity="0.3"/></svg>
                )},
                { pos: 'right', icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="8" height="14" rx="1" fill="currentColor" opacity="0.3"/><rect x="10" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.9"/></svg>
                )},
              ].map(({ pos, icon }) => (
                <button key={pos} className={`position-btn ${panelPosition === pos ? 'active' : ''}`}
                  onClick={() => updatePanelPosition(pos)} title={`Panel on ${pos}`}>{icon}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="map-legend">
          {/* Visibility mode selector */}
          <div className="legend-visibility">
            <div className="legend-visibility-label">Show</div>
            <div className="legend-visibility-pills">
              {[
                { val: 'all',       label: 'All' },
                { val: 'mine',      label: locations.filter(l => l.user_id === user?.id).length > 1 ? 'My clubs' : 'My club' },
                ...(allTeamLocationIds.size > 0 ? [
                  { val: 'team',      label: 'My team' },
                  { val: 'mine_team', label: 'Mine + team' },
                ] : []),
                { val: 'others',    label: 'Others only' },
                { val: 'none',      label: 'Hide all' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  className={`legend-vis-pill ${visibilityMode === val ? 'active' : ''}`}
                  onClick={() => setVisibilityMode(val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="legend-divider" />

          {/* Marker key */}
          {locations.some(l => l.user_id === user?.id) && (
            <div className="legend-row">
              <span className="legend-circle" style={{ background: markerColors.own }} />
              <span>{locations.filter(l => l.user_id === user?.id).length > 1 ? 'My clubs' : 'My club'}</span>
            </div>
          )}
          <div className="legend-row">
            <span className="legend-circle" style={{ background: markerColors.other }} />
            <span>Other clubs</span>
          </div>
          <div className="legend-row">
            <span className="legend-circle" style={{ background: markerColors.selected }} />
            <span>Selected</span>
          </div>
          {isTeamOwner && (
            <div className="legend-row">
              <span className="legend-circle" style={{ background: markerColors.team }} />
              <span>Your team</span>
            </div>
          )}
          {isTeamMember && !isTeamOwner && (
            <div className="legend-row">
              <span className="legend-circle" style={{ background: markerColors.team }} />
              <span>My team</span>
            </div>
          )}
        </div>

        {/* Club count */}
        <div className="map-count">
          <strong>{filteredLocations.length}</strong>
          {hasFilter ? ` of ${locations.length}` : ''} club{filteredLocations.length !== 1 ? 's' : ''}
        </div>

        {/* Save view toast */}
        {saveViewToast && (
          <div className="map-save-toast">✓ Default view saved</div>
        )}
        {/* Geo error toast */}
        {geoError && (
          <div className="map-save-toast map-geo-error">{geoError}</div>
        )}
      </div>

      {/* ── Always-visible dashboard panel ── */}
      <div
        className={[
          'club-panel',
          panelPosition !== 'bottom' && panelWidth === 'wide' ? 'club-panel--wide' : '',
          panelPosition !== 'bottom' && panelCollapsed ? 'club-panel--collapsed' : '',
        ].filter(Boolean).join(' ')}
        onClick={panelCollapsed ? togglePanelCollapsed : undefined}
        style={panelCollapsed ? { cursor: 'pointer' } : {}}
      >
        {/* Collapse/expand tab — only for left/right positions */}
        {panelPosition !== 'bottom' && (
          <button
            className="panel-collapse-tab"
            onClick={e => { e.stopPropagation(); togglePanelCollapsed() }}
            title={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              {/* Right panel: collapsed=point left(open), expanded=point right(close) */}
              {/* Left panel: collapsed=point right(open), expanded=point left(close) */}
              {panelPosition === 'right'
                ? panelCollapsed
                  ? <path d="M6 1l-5 6 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M2 1l5 6-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                : panelCollapsed
                  ? <path d="M2 1l5 6-5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M6 1l-5 6 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          </button>
        )}

        {/* Panel contents — hidden when collapsed */}
        {!panelCollapsed && (
        <div className="club-panel-inner">

          {/* Panel header: width toggle pill */}
          {panelPosition !== 'bottom' && (
            <div className={`panel-width-row panel-width-row--${panelPosition}`}>
              <button
                className={`panel-wide-pill ${panelWidth === 'wide' ? 'active' : ''}`}
                onClick={togglePanelWidth}
              >
                <svg width="13" height="11" viewBox="0 0 14 12" fill="none">
                  <path d="M10 2l3 4-3 4M4 2L1 6l3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="panel-wide-pill-label">Wide panel</span>
                <span className="panel-wide-pill-sub">
                  {panelWidth === 'wide' ? 'click to disable' : 'click to enable'}
                </span>
              </button>
            </div>
          )}

          {/* Pinned: My Club card — collapsible */}
          <div className="cp-my-club-zone">
            <button
              className="cp-my-club-header"
              onClick={() => setMyClubCollapsed(c => !c)}
            >
              {/* Collapsed: show logo/initials + name inline */}
              <div className="cp-my-club-collapsed-row">
                {myClub?.logo_url
                  ? <img src={myClub.logo_url} alt="logo" className="cp-mcc-thumb" />
                  : <div className="cp-mcc-initials">{(myClub?.club_name || 'MC').slice(0,2).toUpperCase()}</div>
                }
                <span className="cp-mcc-name">{myClub?.club_name || 'Your Club'}</span>
              </div>
              <svg
                className={`cp-mcc-chevron ${myClubCollapsed ? '' : 'open'}`}
                width="14" height="14" viewBox="0 0 16 16" fill="none"
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {!myClubCollapsed && (
              <div className="cp-my-club-expanded">
                <MyClubCard myClub={myClub} onManage={() => navigate('/app/profile')} />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="cp-panel-divider" />

          {/* Dynamic: selected club details — hidden when research mode active */}
          {!demoActive && (
            <div className="cp-detail-zone">
              <div className="cp-zone-label">
                {selected ? 'Club Details' : 'Club Details'}
              </div>
              <ClubDetail
                club={selected}
                userId={user?.id}
                panelWidth={panelWidth}
                onManage={() => navigate('/app/profile')}
                radiusMiles={radiusMiles}
                setRadiusMiles={setRadiusMiles}
                customMiles={customMiles}
                setCustomMiles={setCustomMiles}
                filteredCount={filteredLocations.length}
                setGalleryPhotos={setGalleryPhotos}
                onExploreArea={selected?.lat && selected?.lng ? () => {
                  setDemoActive(true)
                  setDemoLat(selected.lat)
                  setDemoLng(selected.lng)
                  setMyClubCollapsed(true)
                } : null}
              />
            </div>
          )}

          {/* Photo gallery modal */}
          {galleryPhotos && (
            <PhotoGallery
              photos={galleryPhotos.photos}
              startIndex={galleryPhotos.start}
              onClose={() => setGalleryPhotos(null)}
            />
          )}

          {/* Demographics panel — research mode */}
          {demoActive && (
            <div className="cp-demo-zone">
              <div className="cp-panel-divider" style={{ margin: '0 -16px 14px' }} />

              {/* Research mode header */}
              <div className="cp-research-header">
                <div className="cp-research-header-icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#4CAF82" strokeWidth="1.5"/>
                    <circle cx="8" cy="8" r="2" fill="#4CAF82"/>
                    <line x1="8" y1="1" x2="8" y2="3.5" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="8" y1="12.5" x2="8" y2="15" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="1" y1="8" x2="3.5" y2="8" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="12.5" y1="8" x2="15" y2="8" stroke="#4CAF82" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="cp-research-header-text">
                  <div className="cp-research-title">Market Research Mode</div>
                  <div className="cp-research-sub">Click anywhere on the map to analyze</div>
                </div>
                <button className="cp-research-exit" onClick={() => { setDemoActive(false); setDemoLat(null); setDemoLng(null) }}>
                  Exit
                </button>
              </div>

              {/* Instruction card — shown before first click */}
              {demoLat == null && (
                <div className="cp-research-instruction">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0F6E56"/>
                  </svg>
                  <div className="cp-research-instruction-text">
                    Your cursor has changed to a targeting reticle. Click any area on the map to load its market data, demographics, and score.
                  </div>
                </div>
              )}

              <DemographicsPanel
                lat={demoLat}
                lng={demoLng}
                locations={locations}
                enabledFactors={enabledFactors}
                active={demoActive}
              />
            </div>
          )}

        </div>
        )} {/* end !panelCollapsed */}
      </div>

    </div>
  )
}
