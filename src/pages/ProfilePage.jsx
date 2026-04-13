import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { geocodeSingle, geocodeZip } from '../lib/geocode'
import {
  MONTHS as SURVEY_MONTHS, YEARS as SURVEY_YEARS,
  TRAINING_OPTIONS, HEAR_HOW_OPTIONS, GOAL_OPTIONS,
  toggleTrainingValue, countAnswered,
} from '../lib/surveyConfig'
import TimePicker from '../components/TimePicker'
import AddressAutocomplete from '../components/AddressAutocomplete'
import CropModal from '../components/CropModal'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday']

const LEVEL_ORDER = [
  'Distributor','Success Builder','Supervisor','World Team','Active World Team',
  'Get Team','Get Team 2500','Millionaire Team','Millionaire Team 7500',
  'Presidents Team','Chairmans Club','Founders Circle'
]

function levelRank(level) {
  if (!level) return -1
  const base = LEVEL_ORDER.find(l => level.startsWith(l))
  return base ? LEVEL_ORDER.indexOf(base) : -1
}

// ── My Team Section ───────────────────────────────────────
function MyTeamSection({ userId, userLevel }) {
  const [appSettings, setAppSettings]     = useState(null)
  const [myTeams, setMyTeams]             = useState([])       // teams I own
  const [memberOf, setMemberOf]           = useState([])       // teams I'm invited to/member of
  const [pendingInvites, setPendingInvites] = useState([])     // incoming invites to my club
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [newTeamName, setNewTeamName]     = useState('')
  const [creating, setCreating]           = useState(false)
  const [inviteQuery, setInviteQuery]     = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [inviting, setInviting]           = useState(null)
  const [inviteTeamId, setInviteTeamId]   = useState(null)
  const [expandedTeamId, setExpandedTeamId] = useState(null)
  const [myLocationId, setMyLocationId]   = useState(null)

  useEffect(() => {
    if (!userId) return
    loadAll()
  }, [userId])

  async function loadAll() {
    setLoading(true)
    const [{ data: s }, { data: myLoc }] = await Promise.all([
      supabase.from('app_settings').select('team_creation_enabled, team_creation_min_level').eq('id', 1).single(),
      supabase.from('locations').select('id').eq('user_id', userId).eq('club_index', 0).single(),
    ])
    setAppSettings(s)
    if (myLoc) setMyLocationId(myLoc.id)

    // Teams I own
    const { data: owned } = await supabase
      .from('teams')
      .select('id, name, created_at, team_members(id, status, location_id, locations(id, club_name, city, state, first_name, last_name))')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false })
    if (owned) setMyTeams(owned)

    // Teams my club is a member of (accepted)
    if (myLoc) {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('id, status, team_id, teams(id, name, owner_user_id)')
        .eq('location_id', myLoc.id)
        .in('status', ['accepted', 'pending'])
      if (memberships) {
        setPendingInvites(memberships.filter(m => m.status === 'pending'))
        setMemberOf(memberships.filter(m => m.status === 'accepted'))
      }
    }
    setLoading(false)
  }

  const canCreateTeam = appSettings?.team_creation_enabled &&
    levelRank(userLevel) >= levelRank(appSettings?.team_creation_min_level || 'Active World Team')

  async function handleCreateTeam(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    setCreating(true)
    const { data } = await supabase.from('teams').insert({ owner_user_id: userId, name: newTeamName.trim() }).select().single()
    if (data) {
      setMyTeams(prev => [{ ...data, team_members: [] }, ...prev])
      setNewTeamName('')
      setShowCreate(false)
      setExpandedTeamId(data.id)
      // Notify admin that a team was created
      await supabase.from('notifications').insert({
        type: 'team_created',
        title: 'New team created',
        body: `A new team "${data.name}" was created.`,
        user_id: userId,
      })
    }
    setCreating(false)
  }

  async function handleSearchInvite(query) {
    setInviteQuery(query)
    if (query.length < 2) { setInviteResults([]); return }
    const { data } = await supabase
      .from('locations')
      .select('id, club_name, city, state, first_name, last_name, user_id')
      .eq('approved', true)
      .eq('club_index', 0)
      .neq('user_id', userId)
      .or(`club_name.ilike.%${query}%,city.ilike.%${query}%,first_name.ilike.%${query}%`)
      .limit(8)
    if (data) setInviteResults(data)
  }

  async function handleInvite(locationId, teamId) {
    setInviting(locationId)
    // Check not already invited
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('location_id', locationId)
      .single()
    if (existing) { setInviting(null); return }

    const { data: inv } = await supabase.from('team_members')
      .insert({ team_id: teamId, location_id: locationId, status: 'pending' })
      .select('id, status, location_id, locations(id, club_name, city, state, first_name, last_name)')
      .single()

    if (inv) {
      setMyTeams(prev => prev.map(t => t.id !== teamId ? t : {
        ...t, team_members: [...(t.team_members || []), inv]
      }))
      // Send in-app notification to the invited club owner
      const { data: invLoc } = await supabase.from('locations').select('user_id').eq('id', locationId).single()
      const team = myTeams.find(t => t.id === teamId)
      if (invLoc?.user_id) {
        await supabase.from('notifications').insert({
          type: 'team_invite',
          title: 'Team invitation',
          body: `You've been invited to join "${team?.name || 'a team'}". Check My Profile → My Team to accept or decline.`,
          user_id: invLoc.user_id,
        })
      }
    }
    setInviteResults([])
    setInviteQuery('')
    setInviting(null)
  }

  async function handleRemoveMember(memberId, teamId) {
    await supabase.from('team_members').delete().eq('id', memberId)
    setMyTeams(prev => prev.map(t => t.id !== teamId ? t : {
      ...t, team_members: t.team_members.filter(m => m.id !== memberId)
    }))
  }

  async function handleRespondInvite(inviteId, accept) {
    const status = accept ? 'accepted' : 'declined'
    await supabase.from('team_members').update({ status, responded_at: new Date().toISOString() }).eq('id', inviteId)
    const invite = pendingInvites.find(i => i.id === inviteId)
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    if (accept) {
      await loadAll()
      // Notify admin that a member joined a team
      if (invite?.teams?.name) {
        await supabase.from('notifications').insert({
          type: 'team_joined',
          title: 'Member joined a team',
          body: `A member accepted an invitation to join "${invite.teams.name}".`,
          user_id: userId,
        })
      }
    }
  }

  async function handleLeaveTeam(memberId) {
    await supabase.from('team_members').delete().eq('id', memberId)
    setMemberOf(prev => prev.filter(m => m.id !== memberId))
  }

  if (loading) return <div className="team-loading">Loading team info…</div>

  return (
    <div className="my-team-section">
      <div className="survey-toggle-btn" style={{ borderRadius: 10, marginBottom: 0, cursor: 'default', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }} className="sec-label">My Team</span>
          {myTeams.length > 0 && <span className="survey-complete-badge">{myTeams.length} team{myTeams.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="team-invites-banner">
          <div className="team-invites-title">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#854F0B" strokeWidth="1.2"/><path d="M8 5v4" stroke="#854F0B" strokeWidth="1.2" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="#854F0B"/></svg>
            {pendingInvites.length} pending team invitation{pendingInvites.length !== 1 ? 's' : ''}
          </div>
          {pendingInvites.map(inv => (
            <div key={inv.id} className="team-invite-row">
              <div className="team-invite-info">
                <span className="team-invite-name">{inv.teams?.name || 'A team'}</span>
              </div>
              <div className="team-invite-actions">
                <button className="team-btn-accept" onClick={() => handleRespondInvite(inv.id, true)}>Accept</button>
                <button className="team-btn-decline" onClick={() => handleRespondInvite(inv.id, false)}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teams I belong to */}
      {memberOf.length > 0 && (
        <div className="team-member-of">
          <div className="team-section-label">Teams I belong to</div>
          {memberOf.map(m => (
            <div key={m.id} className="team-member-of-row">
              <span className="team-name-pill">{m.teams?.name}</span>
              <button className="team-leave-btn" onClick={() => { if (window.confirm('Leave this team?')) handleLeaveTeam(m.id) }}>Leave</button>
            </div>
          ))}
        </div>
      )}

      {/* Teams I own */}
      {myTeams.length > 0 && (
        <div className="team-owned-list">
          <div className="team-section-label">Teams I manage</div>
          {myTeams.map(team => {
            const accepted = team.team_members?.filter(m => m.status === 'accepted') || []
            const pending  = team.team_members?.filter(m => m.status === 'pending')  || []
            const isOpen   = expandedTeamId === team.id
            return (
              <div key={team.id} className="team-card">
                <div className="team-card-header" onClick={() => setExpandedTeamId(isOpen ? null : team.id)}>
                  <div>
                    <span className="team-card-name">{team.name}</span>
                    <span className="team-card-meta">
                      {accepted.length} member{accepted.length !== 1 ? 's' : ''}
                      {pending.length > 0 && ` · ${pending.length} pending`}
                    </span>
                  </div>
                  <svg className={`survey-chevron ${isOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {isOpen && (
                  <div className="team-card-body">
                    {/* Member list */}
                    {team.team_members?.length > 0 && (
                      <div className="team-members-list">
                        {team.team_members.map(m => (
                          <div key={m.id} className="team-member-row">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span className={`team-status-dot team-status-dot--${m.status}`} />
                              <span className="team-member-name">{m.locations?.club_name || 'Club'}</span>
                              <span className="team-member-city">{[m.locations?.city, m.locations?.state].filter(Boolean).join(', ')}</span>
                            </div>
                            <button className="team-remove-btn" onClick={() => handleRemoveMember(m.id, team.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Invite search */}
                    <div className="team-invite-search-wrap">
                      <div className="team-invite-label">Invite a club</div>
                      <div className="team-invite-row-input">
                        <input
                          className="team-invite-input"
                          type="text"
                          placeholder="Search club name, city, or owner…"
                          value={inviteTeamId === team.id ? inviteQuery : ''}
                          onChange={e => { setInviteTeamId(team.id); handleSearchInvite(e.target.value) }}
                          onFocus={() => setInviteTeamId(team.id)}
                        />
                      </div>
                      {inviteTeamId === team.id && inviteResults.length > 0 && (
                        <div className="team-invite-results">
                          {inviteResults.map(r => {
                            const alreadyAdded = team.team_members?.some(m => m.location_id === r.id)
                            return (
                              <div key={r.id} className="team-invite-result-row">
                                <div>
                                  <span className="team-invite-result-name">{r.club_name}</span>
                                  <span className="team-invite-result-city">{[r.city, r.state].filter(Boolean).join(', ')}</span>
                                </div>
                                {alreadyAdded ? (
                                  <span className="team-invite-already">Already added</span>
                                ) : (
                                  <button
                                    className="team-invite-btn"
                                    disabled={inviting === r.id}
                                    onClick={() => handleInvite(r.id, team.id)}
                                  >
                                    {inviting === r.id ? '…' : 'Invite'}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create team */}
      {canCreateTeam && (
        <div style={{ marginTop: 12 }}>
          {!showCreate ? (
            <button className="team-create-btn" onClick={() => setShowCreate(true)}>
              + Create a new team
            </button>
          ) : (
            <form className="team-create-form" onSubmit={handleCreateTeam}>
              <input
                className="team-name-input"
                type="text"
                placeholder="Team name (e.g. Team Empowerment)"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                autoFocus
                maxLength={60}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn-save" type="submit" disabled={creating || !newTeamName.trim()}>
                  {creating ? 'Creating…' : 'Create team'}
                </button>
                <button type="button" className="btn-outline" onClick={() => { setShowCreate(false); setNewTeamName('') }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!canCreateTeam && myTeams.length === 0 && memberOf.length === 0 && pendingInvites.length === 0 && (
        <div className="team-no-access">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#aaa" strokeWidth="1.5"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span>Team creation is available at {appSettings?.team_creation_min_level || 'Active World Team'} and above.</span>
        </div>
      )}
    </div>
  )
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function buildYears() {
  const y = []
  for (let yr = new Date().getFullYear(); yr >= 2006; yr--) y.push(String(yr))
  return y
}
const YEARS = buildYears()

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

// Default shape for one club's data
const DEFAULT_CLUB = {
  id: null,           // DB row id (null = not yet saved)
  club_index: 0,
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
  logo_url: null,
  photo_urls: [],
  lat: null, lng: null,
}

// Owner + story/survey fields stay flat (not per-club)
const DEFAULT_PERSON = {
  first_name: '', last_name: '', owner_email: '',
  owner2_first_name: '', owner2_last_name: '', owner2_email: '', owner2_herbalife_level: '',
  owner3_first_name: '', owner3_last_name: '', owner3_email: '', owner3_herbalife_level: '',
  herbalife_level: '',
  story_why: '', story_favorite_part: '', story_favorite_products: '', story_unique: '',
  story_before: '', story_goal: '',
  survey_upline: '', survey_hl_month: '', survey_hl_year: '',
  survey_active_club: null, survey_club_month: '', survey_club_year: '',
  survey_trainings: '', survey_hear_how: '', survey_hear_detail: '', survey_goal: '',
  survey_goal_detail: '', survey_open_response: '',
}

async function geocodeAddress(address) {
  return geocodeSingle(address)
}

// ── OwnerLevelPicker ──────────────────────────────────────────
function OwnerLevelPicker({ value, onChange }) {
  const K_LEVELS    = ['PT','15K','20K','30K','40K','50K','60K','70K','80K','90K','100K','110K','120K','130K','140K','150K']
  const CC_K_LEVELS = ['CC','FC','15K','20K','30K','40K','50K','60K','70K','80K','90K','100K','110K','120K','130K','140K','150K']

  function parseValue(v) {
    if (!v) return { tier: '', k: '', dia: '', confirmed: false }
    if (v.startsWith('Presidents Team')) {
      const kMatch = v.match(/Presidents Team(?: (\d+K))?/)
      const dMatch = v.match(/(\d+) 💎/)
      return { tier: 'PT', k: kMatch?.[1] || 'PT', dia: dMatch?.[1] || '', confirmed: true }
    }
    if (v.startsWith('Chairmans Club') || v.startsWith('Founders Circle')) {
      const kMatch = v.match(/(\d+K)/)
      const dMatch = v.match(/(\d+) 💎/)
      return { tier: 'FCCC', k: kMatch?.[1] || (v.startsWith('Chairmans Club') ? 'CC' : 'FC'), dia: dMatch?.[1] || '', confirmed: true }
    }
    return { tier: v, k: '', dia: '', confirmed: true }
  }

  const parsed = parseValue(value)
  const [tier,      setTier]      = useState(parsed.tier)
  const [k,         setK]         = useState(parsed.k)
  const [dia,       setDia]       = useState(parsed.dia)
  const [confirmed, setConfirmed] = useState(parsed.confirmed)

  function buildValue(t, kv, dv) {
    if (!t) return ''
    if (t === 'PT') {
      const ks = kv && kv !== 'PT' ? ` ${kv}` : ''
      const ds = dv ? ` ${dv} 💎` : ''
      return `Presidents Team${ks}${ds}`
    }
    if (t === 'FCCC') {
      if (!kv) return ''
      let prefix
      if      (kv === 'CC') prefix = 'Chairmans Club'
      else if (kv === 'FC') prefix = 'Founders Circle'
      else    prefix = parseInt(dv) >= 10 ? 'Founders Circle' : 'Chairmans Club'
      const ks = (kv !== 'CC' && kv !== 'FC') ? ` ${kv}` : ''
      const ds = dv ? ` ${dv} 💎` : ''
      return `${prefix}${ks}${ds}`
    }
    return t
  }

  function isComplete(t, kv, dv) {
    if (!t) return false
    if (t === 'PT')   return !!kv
    if (t === 'FCCC') return !!kv && !!dv
    return true
  }

  function pickTier(t) {
    setTier(t); setK(''); setDia(''); setConfirmed(false)
    if (t !== 'PT' && t !== 'FCCC') { onChange(t) }
    else onChange('')
  }

  function confirm() {
    const v = buildValue(tier, k, dia)
    if (v) { setConfirmed(true); onChange(v) }
  }

  function clear() {
    setTier(''); setK(''); setDia(''); setConfirmed(false); onChange('')
  }

  const displayVal = buildValue(tier, k, dia)

  return (
    <div className="lvl-picker" style={{ marginTop: 4 }}>
      {confirmed ? (
        <div className="lvl-locked-state" style={{ marginTop: 0 }}>
          <div className="lvl-locked-check">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5l3.5 3.5 5.5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="lvl-locked-text">
            <strong>{value.includes(' 💎') ? <>{value.replace(/ (\d+) 💎$/, (_, d) => ` ${d} `)}<span style={{ fontSize: 11 }}>💎</span></> : value}</strong>
          </div>
          <button className="lvl-change-btn" onClick={clear}>Change</button>
        </div>
      ) : (
        <>
          <div className="lvl-picker-inner">
            <div className="lvl-group-label">Tab Team</div>
            <div className="lvl-btn-row">
              {[
                { val: 'Distributor',       label: 'DS',  c: '#e3e3e3', cd: '#555' },
                { val: 'Success Builder',   label: 'SB',  c: '#e3e3e3', cd: '#555' },
                { val: 'Supervisor',        label: 'SP',  c: '#64ba44', cd: '#2a6b1a' },
                { val: 'World Team',        label: 'WT',  c: '#767678', cd: '#3a3a3a' },
                { val: 'Active World Team', label: 'AWT', c: '#767678', cd: '#3a3a3a' },
              ].map(({ val, label, c, cd }) => (
                <button key={val} type="button" className={`lvl-btn ${tier === val ? 'on' : ''}`}
                  style={{ '--lvlc': c, '--lvlcd': cd }} onClick={() => pickTier(val)}>{label}</button>
              ))}
            </div>
            <div className="lvl-group-label" style={{ marginTop: 10 }}>Future Pres Team 🚀</div>
            <div className="lvl-btn-row">
              {[
                { val: 'Get Team',              label: 'GT', c: '#e02054', cd: '#8a0020' },
                { val: 'Get Team 2500',         label: 'GP', c: '#f39519', cd: '#7a4200' },
                { val: 'Millionaire Team',      label: 'MT', c: '#3aac77', cd: '#0c5a32' },
                { val: 'Millionaire Team 7500', label: 'MP', c: '#84c8d3', cd: '#1a5a60' },
              ].map(({ val, label, c, cd }) => (
                <button key={val} type="button" className={`lvl-btn ${tier === val ? 'on' : ''}`}
                  style={{ '--lvlc': c, '--lvlcd': cd }} onClick={() => pickTier(val)}>{label}</button>
              ))}
            </div>
            <div className="lvl-group-label" style={{ marginTop: 10 }}>Pres Team 💎</div>
            <div className="lvl-btn-row">
              <button type="button" className={`lvl-btn ${tier === 'PT' ? 'on' : ''}`}
                style={{ '--lvlc': '#fde488', '--lvlcd': '#7a5200' }} onClick={() => pickTier('PT')}>PT</button>
            </div>
            <div className="lvl-group-label" style={{ marginTop: 10 }}>Chairman's &amp; Founders 🥈✦</div>
            <div className="lvl-btn-row">
              <button type="button" className={`lvl-btn lvl-btn-cc ${tier === 'FCCC' ? 'on' : ''}`}
                onClick={() => pickTier('FCCC')}>CC / FC</button>
            </div>
            {tier === 'PT' && (
              <div className="lvl-diamond-wrap" style={{ marginTop: 8 }}>
                <div className="lvl-diamond-label">K level — required</div>
                <div className="lvl-btn-row">
                  {K_LEVELS.map(kv => (
                    <button key={kv} type="button" className={`lvl-dia-btn ${k === kv ? 'on' : ''}`}
                      onClick={() => { setK(kv); setDia(''); setConfirmed(false) }}>{kv}</button>
                  ))}
                </div>
              </div>
            )}
            {tier === 'PT' && k && (
              <div className="lvl-diamond-wrap" style={{ marginTop: 6 }}>
                <div className="lvl-diamond-label">Diamonds — optional</div>
                <div className="lvl-btn-row">
                  {['1','2','3','4'].map(d => (
                    <button key={d} type="button" className={`lvl-dia-btn ${dia === d ? 'on' : ''}`}
                      onClick={() => { setDia(dia === d ? '' : d); setConfirmed(false) }}>
                      {d} <span style={{ fontSize: 11 }}>💎</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tier === 'FCCC' && (
              <div className="lvl-diamond-wrap lvl-diamond-wrap--cc" style={{ marginTop: 8 }}>
                <div className="lvl-diamond-label" style={{ color: '#5a5a72' }}>K level — required</div>
                <div className="lvl-btn-row">
                  {CC_K_LEVELS.map(kv => (
                    <button key={kv} type="button" className={`lvl-dia-btn lvl-dia-btn--cc ${k === kv ? 'on' : ''}`}
                      onClick={() => { setK(kv); setDia(''); setConfirmed(false) }}>{kv}</button>
                  ))}
                </div>
              </div>
            )}
            {tier === 'FCCC' && k && (
              <div className="lvl-diamond-wrap lvl-diamond-wrap--cc" style={{ marginTop: 6 }}>
                <div className="lvl-diamond-label" style={{ color: '#5a5a72' }}>Diamonds — required (5–15)</div>
                <div className="lvl-btn-row">
                  {['5','6','7','8','9','10','11','12','13','14','15'].map(d => (
                    <button key={d} type="button" className={`lvl-dia-btn lvl-dia-btn--cc ${dia === d ? 'on' : ''}`}
                      onClick={() => { setDia(d); setConfirmed(false) }}>
                      {d} <span style={{ fontSize: 11 }}>💎</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {isComplete(tier, k, dia) && (
            <button className="lvl-confirm-btn" style={{ marginTop: 8 }} onClick={confirm}>
              Confirm: {displayVal.replace(/ (\d+) 💎$/, '')}
              {displayVal.includes(' 💎') && <> {displayVal.match(/ (\d+) 💎$/)?.[1]} <span style={{ fontSize: 11 }}>💎</span></>}
            </button>
          )}
          {tier && (
            <button type="button" onClick={clear}
              style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', background: 'none',
                border: '0.5px solid #ccc', borderRadius: 6, color: '#888', cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
        </>
      )}
    </div>
  )
}

function OwnerPhotoUpload({ label, photoUrl, onUpload, uploading }) {
  const inputRef = useRef()
  return (
    <div className="owner-photo-upload">
      <div className="owner-photo-preview">
        {uploading && (
          <div className="photo-upload-progress-overlay">
            <div className="photo-upload-progress-bar">
              <div className="photo-upload-progress-fill photo-upload-progress-fill--indeterminate" />
            </div>
          </div>
        )}
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
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
    </div>
  )
}

// ── Add Club Confirmation Modal ───────────────────────────────
function AddClubPrompt({ clubCount, onConfirm, onCancel }) {
  const ordinal = clubCount === 1 ? 'Second' : 'Third'
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box add-club-modal" onClick={e => e.stopPropagation()}>
        <div className="add-club-modal-icon">🏪</div>
        <h3>Add a {ordinal} Club Location?</h3>
        <p>You're adding another club profile. Each club has its own address, hours, and photos — but shares your owner info and story.</p>
        {clubCount === 2 && <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>This will be your last — 3 clubs maximum per account.</p>}
        <div className="add-club-modal-btns">
          <button className="btn-save" onClick={onConfirm}>Yes, Add Club</button>
          <button className="add-club-cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Remove Club Confirmation Modal ────────────────────────────
function RemoveClubPrompt({ clubName, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box add-club-modal" onClick={e => e.stopPropagation()}>
        <div className="add-club-modal-icon" style={{ fontSize: 28 }}>⚠️</div>
        <h3>Remove "{clubName || 'this club'}"?</h3>
        <p>This will permanently delete this club's profile, address, hours, and photos. This cannot be undone.</p>
        <div className="add-club-modal-btns">
          <button className="btn-save" style={{ background: '#C0392B' }} onClick={onConfirm}>Yes, Remove Club</button>
          <button className="add-club-cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── ClubEditor: renders one club's fields ─────────────────────
function ClubEditor({ club, clubIndex, userId, isOnly, allClubs, onSaved, onRemove, userEmail, personData }) {
  const [form, setForm]       = useState({ ...DEFAULT_CLUB, ...club })
  const [savedForm, setSavedForm] = useState({ ...DEFAULT_CLUB, ...club })
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const [saveAction, setSaveAction] = useState(null)
  const [toast, setToast]     = useState('')
  const [zipLooking, setZipLooking] = useState(false)
  const [showRemovePrompt, setShowRemovePrompt] = useState(false)
  const navigate = useNavigate()

  const [logoUrl, setLogoUrl]     = useState(club.logo_url || null)
  const [photoUrls, setPhotoUrls] = useState(club.photo_urls || [])
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [uploadError, setUploadError]       = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null) // null | { done, total }
  const logoInputRef  = useRef()
  const photoInputRef = useRef()

  const [cropSrc, setCropSrc]     = useState(null)
  const [dragIdx, setDragIdx]     = useState(null)   // index of photo being dragged
  const [dropTarget, setDropTarget] = useState(null) // insertion position (0..n)

  const [copySource, setCopySource]   = useState(null)
  const [copyTargets, setCopyTargets] = useState({})
  const [showCrossClubCopy, setShowCrossClubCopy] = useState(false)
  const isDirty = JSON.stringify({ ...form, logo_url: logoUrl, photo_urls: photoUrls })
    !== JSON.stringify({ ...savedForm, logo_url: savedForm.logo_url, photo_urls: savedForm.photo_urls })

  // Required fields filled check — enables/disables save buttons
  const requiredFilled = !!(
    form.club_name.trim() && form.club_email.trim() && form.address.trim() &&
    form.zip.trim() && form.city.trim() && form.state.trim() &&
    form.opened_month && form.opened_year &&
    DAYS.some(d => form['hours_' + d + '_open'] && form['hours_' + d + '_close'])
  )

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }))
  }

  function handlePhoneChange(raw) { setField('club_phone', formatPhone(raw)) }

  async function handleZipBlur(zip) {
    if (zip.length < 5) return
    setZipLooking(true)
    try {
      const result = await geocodeZip(zip)
      if (result) {
        setForm(f => ({ ...f, city: result.city || f.city, state: result.state || f.state }))
      }
    } catch {}
    setZipLooking(false)
  }

  async function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function saveCroppedLogo(blob) {
    setCropSrc(null)
    setUploadingLogo(true)
    setUploadError(null)
    const path = userId + '/logo' + (clubIndex > 0 ? `-${clubIndex}` : '') + '.jpg'
    const { error } = await supabase.storage.from('club-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      console.error('[ClubEditor] Logo upload error:', error.message)
      setUploadError('Upload failed: ' + error.message)
    } else {
      const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setLogoUrl(url)
    }
    setUploadingLogo(false)
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const slots = Math.min(files.length, 10 - photoUrls.length)
    if (slots <= 0) return
    setUploadProgress({ done: 0, total: slots })
    setUploadError(null)
    const newUrls = [...photoUrls]
    for (let i = 0; i < slots; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()
      const path = userId + '/photos/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext
      const { error } = await supabase.storage.from('club-photos').upload(path, file)
      if (error) {
        console.error('[ClubEditor] Photo upload error:', error.message)
        setUploadError('Photo upload failed: ' + error.message)
      } else {
        const { data } = supabase.storage.from('club-photos').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
      setUploadProgress({ done: i + 1, total: slots })
    }
    setPhotoUrls(newUrls)
    setUploadProgress(null)
  }

  function validate() {
    const e = {}
    if (!form.club_name.trim())  e.club_name  = 'Required'
    if (!form.club_email.trim()) e.club_email = 'Required'
    if (!form.address.trim())    e.address    = 'Required'
    if (!form.zip.trim())        e.zip        = 'Required'
    if (!form.city.trim())       e.city       = 'Required'
    if (!form.state.trim())      e.state      = 'Required'
    if (!form.opened_month)      e.opened_month = 'Required'
    if (!form.opened_year)       e.opened_year  = 'Required'
    const hasHours = DAYS.some(d => form['hours_' + d + '_open'] && form['hours_' + d + '_close'])
    if (!hasHours) e.hours = 'At least one day of hours is required'
    DAYS.forEach(d => {
      const o = form['hours_' + d + '_open'], c = form['hours_' + d + '_close']
      if ((o && !c) || (!o && c)) e['hours_' + d] = 'Both open and close required'
    })
    return e
  }

  async function handleSave(action) {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaveAction(action); setSaving(true)

    const isNew = !form.id

    const record = {
      user_id: userId,
      club_index: clubIndex,
      ...form,
      state_zip: (form.state + ' ' + form.zip).trim(),
      logo_url: logoUrl,
      photo_urls: photoUrls,
      // Always sync person fields from person form / first club — keeps all location rows in sync
      ...(() => {
        const src = personData && personData.first_name ? personData : (allClubs && allClubs[0]) || {}
        const fields = {}
        const PERSON_KEYS = [
          'first_name', 'last_name', 'owner_email', 'herbalife_level',
          'owner2_first_name', 'owner2_last_name', 'owner2_email', 'owner2_herbalife_level',
          'owner3_first_name', 'owner3_last_name', 'owner3_email', 'owner3_herbalife_level',
          'owner_photo_url', 'owner2_photo_url', 'owner3_photo_url',
          'survey_upline', 'survey_hl_month', 'survey_hl_year',
          'survey_active_club', 'survey_club_month', 'survey_club_year',
          'survey_trainings', 'survey_hear_how', 'survey_hear_detail', 'survey_goal',
          'survey_goal_detail', 'survey_open_response',
          'survey_completed_at',
        ]
        PERSON_KEYS.forEach(k => { if (src[k]) fields[k] = src[k] })
        return fields
      })(),
    }
    delete record.id

    let result
    if (isNew) {
      // Check if approval is required
      const { data: appSettings } = await supabase.from('app_settings').select('require_approval').eq('id', 1).single()
      record.approved = appSettings?.require_approval ? false : true
      result = await supabase.from('locations').insert(record).select().single()
    } else {
      result = await supabase.from('locations').update(record).eq('id', form.id).select().single()
    }

    if (result.error) {
      setErrors({ _general: result.error.message })
      setSaving(false); setSaveAction(null)
      return
    }

    const savedRow = result.data
    const newForm = { ...form, id: savedRow.id }
    setForm(newForm)
    setSavedForm({ ...newForm, logo_url: logoUrl, photo_urls: photoUrls })

    if (isNew) {
      await supabase.from('notifications').insert({
        type: 'new_profile',
        title: 'New club profile submitted',
        body: `${form.club_name || 'A new club'} just set up their profile${form.city ? ` in ${form.city}${form.state ? `, ${form.state}` : ''}` : ''}.`,
        user_id: userId,
      })
    }
    onSaved && onSaved(savedRow)

    // Geocode — update the row so it appears on the map
    const fullAddress = [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ')
    if (fullAddress) {
      try {
        const coords = await geocodeAddress(fullAddress)
        if (coords) {
          await supabase.from('locations').update({ lat: coords.lat, lng: coords.lng }).eq('id', savedRow.id)
        } else {
          console.warn('[ClubEditor] Geocode returned null for:', fullAddress, '— is VITE_MAPBOX_TOKEN set?')
        }
      } catch (err) {
        console.error('[ClubEditor] Geocode error:', err.message)
      }
    }

    if (action === 'map') {
      navigate('/app/map')
    } else {
      setToast('Club saved ✓')
      setTimeout(() => setToast(''), 3000)
    }
    setSaving(false); setSaveAction(null)
  }

  async function handleRemove() {
    if (!form.id) { onRemove && onRemove(); return }
    const { error } = await supabase.from('locations').delete().eq('id', form.id)
    if (!error) onRemove && onRemove()
  }

  function applyCopyToTargets() {
    if (!copySource) return
    const o = form['hours_' + copySource + '_open'], c = form['hours_' + copySource + '_close']
    const updates = {}
    Object.entries(copyTargets).forEach(([day, checked]) => {
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

  // Cross-club hour copying
  const otherClubs = (allClubs || []).filter((_, i) => i !== clubIndex).filter(c =>
    DAYS.some(d => c['hours_' + d + '_open'] && c['hours_' + d + '_close'])
  )
  function copyHoursFromClub(sourceClub) {
    const updates = {}
    DAYS.forEach(d => {
      updates['hours_' + d + '_open']  = sourceClub['hours_' + d + '_open']  || ''
      updates['hours_' + d + '_close'] = sourceClub['hours_' + d + '_close'] || ''
    })
    setForm(f => ({ ...f, ...updates }))
    setShowCrossClubCopy(false)
  }

  const errorCount = Object.keys(errors).filter(k => k !== '_general' && errors[k]).length

  return (
    <div className="club-editor">
      {errors._general && <div className="error-msg">{errors._general}</div>}
      {errorCount > 0 && <div className="error-msg">Please fix {errorCount} required field{errorCount !== 1 ? 's' : ''} below.</div>}

      {/* Club Info */}
      <div className="club-section">
        <div className="sec-label" style={{ marginBottom: 12 }}>Club Info</div>
        <div className="fgrid">
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club name <span className="req-star">*</span></label>
            <input type="text" name="club_name" value={form.club_name} onChange={e => setField('club_name', e.target.value)}
              placeholder="Your Club Name" className={errors.club_name ? 'input-err' : ''} tabIndex={1} />
            {errors.club_name && <span className="field-err">{errors.club_name}</span>}
          </div>
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club email <span className="req-star">*</span></label>
            <input type="email" name="club_email" value={form.club_email} onChange={e => setField('club_email', e.target.value)}
              placeholder="hello@yourclub.com" className={errors.club_email ? 'input-err' : ''}
              tabIndex={2}
              readOnly={!form.id && clubIndex === 0 && !!userEmail}
              style={!form.id && clubIndex === 0 && userEmail ? { background: '#f8faf9', color: '#555', cursor: 'default' } : {}} />
            {!form.id && clubIndex === 0 && userEmail && (
              <span className="field-hint">Pre-filled from your account email — you can update this after saving</span>
            )}
            {errors.club_email && <span className="field-err">{errors.club_email}</span>}
          </div>
          <div className="pf" style={{ gridColumn: '1 / -1' }}>
            <label>Club phone <span className="optional-tag">optional</span></label>
            <input type="tel" name="club_phone" value={form.club_phone}
              onChange={e => handlePhoneChange(e.target.value)}
              placeholder="(555) 000-0000" tabIndex={3} />
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
              tabIndex={4}
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

      {/* Club Specifics */}
      <div className="club-section">
        <div className="sec-label" style={{ marginBottom: 12 }}>Club Specifics</div>

        <div className="fgrid" style={{ marginBottom: 24 }}>
          <div className="pf">
            <label>Month opened <span className="req-star">*</span></label>
            <select value={form.opened_month} onChange={e => setField('opened_month', e.target.value)}
              className={errors.opened_month ? 'input-err' : ''} tabIndex={5}>
              <option value="">Select month</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {errors.opened_month && <span className="field-err">{errors.opened_month}</span>}
          </div>
          <div className="pf">
            <label>Year opened <span className="req-star">*</span></label>
            <select value={form.opened_year} onChange={e => setField('opened_year', e.target.value)}
              className={errors.opened_year ? 'input-err' : ''} tabIndex={6}>
              <option value="">Select year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {errors.opened_year && <span className="field-err">{errors.opened_year}</span>}
          </div>
        </div>

        {/* Hours */}
        <div className="sec-sublabel">Hours of operation <span className="req-star">*</span></div>
        {errors.hours && <div className="field-err" style={{ marginBottom: 8 }}>{errors.hours}</div>}
        {otherClubs.length > 0 && (
          <button className="cross-club-copy-btn" type="button" onClick={() => setShowCrossClubCopy(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5"/></svg>
            Copy hours from another club
          </button>
        )}
        {showCrossClubCopy && (
          <div className="cross-club-copy-panel">
            <div className="cross-club-copy-title">Copy all hours from:</div>
            {otherClubs.map((oc, i) => {
              const preview = DAYS.filter(d => oc['hours_' + d + '_open'] && oc['hours_' + d + '_close'])
                .slice(0, 2)
                .map(d => `${DAY_LABELS[DAYS.indexOf(d)]} ${oc['hours_' + d + '_open']}–${oc['hours_' + d + '_close']}`)
                .join(', ')
              return (
                <button key={i} className="cross-club-copy-item" type="button" onClick={() => copyHoursFromClub(oc)}>
                  <span className="cross-club-copy-name">{oc.club_name || `Club ${i + 2}`}</span>
                  {preview && <span className="cross-club-copy-preview">{preview}{DAYS.filter(d => oc['hours_' + d + '_open']).length > 2 ? '…' : ''}</span>}
                </button>
              )
            })}
            <button className="cross-club-copy-cancel" type="button" onClick={() => setShowCrossClubCopy(false)}>Cancel</button>
          </div>
        )}
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
                  tabIndex={7 + i * 2}
                />
                <span className="hrs-dash">–</span>
                <TimePicker
                  value={form['hours_' + day + '_close']}
                  onChange={v => setField('hours_' + day + '_close', v)}
                  placeholder="Close"
                  defaultPeriod="PM"
                  tabIndex={8 + i * 2}
                />
              </div>
              <button className="copy-hours-btn" tabIndex={-1} title="Copy to other days"
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

        {/* Social + Website */}
        <div className="sec-sublabel" style={{ marginTop: 24 }}>Social media &amp; website <span className="optional-tag">all optional</span></div>
        {[
          {
            key: 'website',
            label: 'Website',
            placeholder: 'yoursite.com',
            validate: v => {
              if (!v) return null
              // must look like a domain or URL
              return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v) ? null : 'Enter a valid website URL'
            },
            previewUrl: v => {
              if (!v) return null
              return /^https?:\/\//.test(v) ? v : 'https://' + v
            },
            previewLabel: v => v,
          },
          {
            key: 'social_facebook',
            label: 'Facebook',
            placeholder: 'facebook.com/yourpage or yourpage',
            validate: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '').replace(/^@/, '').trim()
              return handle.length >= 1 ? null : 'Enter a valid Facebook page name'
            },
            previewUrl: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '').replace(/^@/, '').trim()
              return handle ? `https://facebook.com/${handle}` : null
            },
            previewLabel: v => {
              const handle = v.replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '').replace(/^@/, '').trim()
              return `facebook.com/${handle}`
            },
          },
          {
            key: 'social_instagram',
            label: 'Instagram',
            placeholder: '@yourhandle',
            validate: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return /^[\w](?:[\w.]{1,28}[\w])?$/.test(handle) ? null : 'Instagram handles are 3–30 characters: letters, numbers, periods, underscores'
            },
            previewUrl: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return handle ? `https://instagram.com/${handle}` : null
            },
            previewLabel: v => {
              const handle = v.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return `@${handle}`
            },
          },
          {
            key: 'social_tiktok',
            label: 'TikTok',
            placeholder: '@yourhandle',
            validate: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return /^[\w.]{2,24}$/.test(handle) ? null : 'TikTok handles are 2–24 characters: letters, numbers, underscores, periods'
            },
            previewUrl: v => {
              if (!v) return null
              const handle = v.replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return handle ? `https://tiktok.com/@${handle}` : null
            },
            previewLabel: v => {
              const handle = v.replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/, '').replace(/^@/, '').replace(/\/$/, '').trim()
              return `@${handle}`
            },
          },
          {
            key: 'social_youtube',
            label: 'YouTube',
            placeholder: 'youtube.com/yourchannel or @handle',
            validate: v => {
              if (!v) return null
              const clean = v.replace(/^(https?:\/\/)?(www\.)?youtube\.com\//, '').replace(/\/$/, '').trim()
              return clean.length >= 1 ? null : 'Enter a valid YouTube channel URL or handle'
            },
            previewUrl: v => {
              if (!v) return null
              const clean = v.replace(/^(https?:\/\/)?(www\.)?youtube\.com\//, '').replace(/\/$/, '').trim()
              const path = clean.startsWith('@') ? clean : (clean.startsWith('channel/') || clean.startsWith('c/') || clean.startsWith('user/') ? clean : `@${clean}`)
              return `https://youtube.com/${path}`
            },
            previewLabel: v => {
              const clean = v.replace(/^(https?:\/\/)?(www\.)?youtube\.com\//, '').replace(/\/$/, '').trim()
              return clean.startsWith('@') ? clean : `youtube.com/${clean}`
            },
          },
        ].map(({ key, label, placeholder, validate, previewUrl, previewLabel }, si) => {
          const val = form[key] || ''
          const validationError = val ? validate(val) : null
          const preview = val && !validationError ? previewUrl(val) : null
          return (
            <div className="soc-row soc-row--with-preview" key={key}>
              <span className="soc-lbl">{label}</span>
              <div className="pf soc-input-wrap">
                <input type="text" value={val}
                  onChange={e => setField(key, e.target.value)}
                  placeholder={placeholder}
                  tabIndex={21 + si}
                  className={validationError ? 'input-err' : val ? 'input-ok' : ''}
                />
                {validationError && (
                  <span className="field-err soc-field-err">{validationError}</span>
                )}
                {preview && (
                  <a className="soc-preview-link" href={preview} target="_blank" rel="noreferrer">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
                      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {previewLabel(val)}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Photos */}
      <div className="club-section">
        <div className="sec-label" style={{ marginBottom: 12 }}>Club Photos <span className="optional-tag">optional</span></div>

        <div className="photo-section">
          <div className="photo-section-title">Club Logo</div>
          <div className="logo-upload-row">
            {logoUrl
              ? <div className="logo-preview"><img src={logoUrl} alt="Club logo" /><button className="photo-remove-btn" onClick={() => setLogoUrl(null)}>✕</button></div>
              : <div className="upload-placeholder logo-placeholder"><span>No logo yet</span></div>
            }
            {uploadingLogo && (
              <div style={{ width: '100%', maxWidth: 120 }}>
                <div className="photo-upload-progress-bar-wrap">
                  <div className="photo-upload-progress-fill photo-upload-progress-fill--indeterminate" />
                </div>
              </div>
            )}
            <div>
              <button className="upload-btn" onClick={() => logoInputRef.current && logoInputRef.current.click()} disabled={uploadingLogo}>
                {uploadingLogo ? 'Uploading…' : logoUrl ? '↑ Replace Logo' : '↑ Upload Logo'}
              </button>
              <p className="upload-hint">PNG or JPG, square preferred</p>
              {uploadError && <p className="field-err" style={{ marginTop: 4 }}>{uploadError}</p>}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        <div className="photo-section" style={{ marginTop: 20 }}>
          <div className="photo-section-title">Club Photos</div>
          <p className="upload-hint" style={{ marginBottom: 12 }}>Up to 10 photos. Drag to reorder — first photo is your cover.</p>
          <div className={`photos-strip${dragIdx !== null ? ' photos-strip--dragging' : ''}`}>
            {Array.from({ length: 10 }).map((_, slotIdx) => {
              const url = photoUrls[slotIdx]
              const isUploading = !url && uploadProgress && slotIdx === photoUrls.length

              if (url) {
                return (
                  <div key={url} className={[
                    'photo-strip-tile photo-strip-tile--filled',
                    dragIdx === slotIdx ? 'photo-strip-tile--dragging' : '',
                    dragIdx !== null && dragIdx !== slotIdx ? 'photo-strip-tile--dimmed' : '',
                  ].filter(Boolean).join(' ')}
                    draggable
                    onDragStart={() => { setDragIdx(slotIdx); setDropTarget(null) }}
                    onDragEnd={() => { setDragIdx(null); setDropTarget(null) }}
                    onDragOver={e => { e.preventDefault(); setDropTarget(slotIdx) }}
                    onDrop={() => {
                      if (dragIdx === null) return
                      const newUrls = [...photoUrls]
                      const [moved] = newUrls.splice(dragIdx, 1)
                      const insertAt = dropTarget > dragIdx ? dropTarget - 1 : dropTarget
                      newUrls.splice(insertAt, 0, moved)
                      setPhotoUrls(newUrls)
                      setDragIdx(null); setDropTarget(null)
                    }}
                  >
                    <img src={url} alt={'Club photo ' + (slotIdx + 1)} />
                    {slotIdx === 0 && <span className="photo-cover-badge">Cover</span>}
                    <span className="photo-drag-handle">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="3" cy="3" r="1.2" fill="white"/><circle cx="3" cy="6" r="1.2" fill="white"/><circle cx="3" cy="9" r="1.2" fill="white"/>
                        <circle cx="9" cy="3" r="1.2" fill="white"/><circle cx="9" cy="6" r="1.2" fill="white"/><circle cx="9" cy="9" r="1.2" fill="white"/>
                      </svg>
                    </span>
                    <button className="photo-remove-btn" onClick={() => setPhotoUrls(p => p.filter((_, idx) => idx !== slotIdx))}>✕</button>
                  </div>
                )
              }

              if (isUploading) {
                return (
                  <div key="uploading" className="photo-strip-tile photo-strip-tile--uploading">
                    <div className="photo-upload-spinner" />
                    <div className="photo-upload-progress-text" style={{ fontSize: 10, marginTop: 4 }}>
                      {uploadProgress.done}/{uploadProgress.total}
                    </div>
                    <div className="photo-upload-progress-bar-wrap" style={{ marginTop: 4 }}>
                      <div className="photo-upload-progress-bar" style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }} />
                    </div>
                  </div>
                )
              }

              // Empty slot
              const isAddSlot = slotIdx === photoUrls.length && !uploadProgress
              return (
                <div
                  key={`empty-${slotIdx}`}
                  className={`photo-strip-tile photo-strip-tile--empty${isAddSlot ? ' photo-strip-tile--add' : ''}`}
                  onClick={isAddSlot ? () => photoInputRef.current && photoInputRef.current.click() : undefined}
                  title={isAddSlot ? 'Add photo' : ''}
                >
                  {isAddSlot ? (
                    <span style={{ fontSize: 22, color: '#bbb', lineHeight: 1 }}>+</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>
      </div>

      {/* Crop modal (logo only in this component) */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onSave={saveCroppedLogo}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Per-club save bar — sticky when dirty or unsaved */}
      <div className={`club-save-bar${isDirty || !form.id ? ' club-save-bar--visible' : ''}${isDirty ? ' club-save-bar--sticky' : ''}`}>
        {isDirty && form.id && (
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
          <button className="btn-save" onClick={() => handleSave('save')} disabled={saving || (!isDirty && !!form.id) || !requiredFilled}>
            {saving && saveAction === 'save' ? 'Saving…' : 'Save Club'}
          </button>
        </div>
        {!isOnly && (
          <div className="remove-club-zone">
            <button className="remove-club-btn" onClick={() => setShowRemovePrompt(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Remove this club
            </button>
          </div>
        )}
      </div>

      {showRemovePrompt && (
        <RemoveClubPrompt
          clubName={form.club_name}
          onConfirm={() => { setShowRemovePrompt(false); handleRemove() }}
          onCancel={() => setShowRemovePrompt(false)}
        />
      )}

      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  )
}

// ── Main ProfilePage ──────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [personForm, setPersonForm] = useState(DEFAULT_PERSON)
  const [savedPersonForm, setSavedPersonForm] = useState(null)
  const [clubs, setClubs]           = useState([])   // array of DB rows
  const [activeTab, setActiveTab]   = useState(0)    // index into clubs[]
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [personToast, setPersonToast] = useState('')
  const [personErrors, setPersonErrors] = useState({})

  const [showOwner2, setShowOwner2] = useState(false)
  const [showOwner3, setShowOwner3] = useState(false)
  const [owner1Collapsed, setOwner1Collapsed] = useState(false) // expanded by default for new users; collapses after data loads for returning users
  const [owner2Collapsed, setOwner2Collapsed] = useState(true)
  const [owner3Collapsed, setOwner3Collapsed] = useState(true)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [storyOpen,  setStoryOpen]  = useState(false)

  const [ownerPhotoUrl,  setOwnerPhotoUrl]  = useState(null)
  const [owner2PhotoUrl, setOwner2PhotoUrl] = useState(null)
  const [owner3PhotoUrl, setOwner3PhotoUrl] = useState(null)
  const [uploadingOwnerPhoto,  setUploadingOwnerPhoto]  = useState(false)
  const [uploadingOwner2Photo, setUploadingOwner2Photo] = useState(false)
  const [uploadingOwner3Photo, setUploadingOwner3Photo] = useState(false)

  const [cropSrc, setCropSrc]       = useState(null)
  const [cropTarget, setCropTarget] = useState(null)

  const [showAddClubPrompt, setShowAddClubPrompt] = useState(false)
  const [myClubsOpen, setMyClubsOpen] = useState(false)
  const [showTeamInfoModal, setShowTeamInfoModal] = useState(false)
  const [teamInfoSettings, setTeamInfoSettings] = useState(null)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Does user's level meet the minimum for teams?
  const meetsTeamLevel = teamInfoSettings
    ? levelRank(personForm.herbalife_level) >= levelRank(teamInfoSettings.team_creation_min_level || 'Active World Team')
    : false

  const isPersonDirty = savedPersonForm !== null
    ? JSON.stringify({ ...personForm, _p1: ownerPhotoUrl, _p2: owner2PhotoUrl, _p3: owner3PhotoUrl })
      !== JSON.stringify({ ...savedPersonForm, _p1: savedPersonForm._p1, _p2: savedPersonForm._p2, _p3: savedPersonForm._p3 })
    : false

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    async function load() {
      if (!user) return
      // Only do the full load once — tab switches / auth refreshes should not wipe unsaved state
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true

      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', user.id)
        .order('club_index', { ascending: true })

      if (data && data.length > 0) {
        // Load person fields from first row
        const row0 = data[0]
        const pf = { ...DEFAULT_PERSON }
        Object.keys(DEFAULT_PERSON).forEach(k => { if (row0[k] != null) pf[k] = row0[k] })
        setPersonForm(pf)

        if (row0.owner2_first_name) setShowOwner2(true)
        if (row0.owner3_first_name) setShowOwner3(true)
        if (row0.owner_photo_url)  setOwnerPhotoUrl(row0.owner_photo_url)
        if (row0.owner2_photo_url) setOwner2PhotoUrl(row0.owner2_photo_url)
        if (row0.owner3_photo_url) setOwner3PhotoUrl(row0.owner3_photo_url)

        setSavedPersonForm({ ...pf, _p1: row0.owner_photo_url || null, _p2: row0.owner2_photo_url || null, _p3: row0.owner3_photo_url || null })

        // Collapse owner card for returning users who already have their name filled in
        if (pf.first_name) setOwner1Collapsed(true)

        // Build clubs array — one entry per row (include ALL DB fields, not just DEFAULT_CLUB keys)
        setClubs(data.map(row => {
          const c = { ...DEFAULT_CLUB, ...row }
          return c
        }))

        // Auto-sync: if first club has person data but other clubs are missing it, push to all rows
        if (data.length > 1 && row0.first_name) {
          const needsSync = data.slice(1).some(r => !r.first_name)
          if (needsSync) {
            const syncFields = {}
            const SYNC_KEYS = [
              'first_name', 'last_name', 'owner_email', 'herbalife_level',
              'owner2_first_name', 'owner2_last_name', 'owner2_email', 'owner2_herbalife_level',
              'owner3_first_name', 'owner3_last_name', 'owner3_email', 'owner3_herbalife_level',
              'owner_photo_url', 'owner2_photo_url', 'owner3_photo_url',
              'story_why', 'story_favorite_part', 'story_favorite_products', 'story_unique',
              'story_before', 'story_goal',
              'survey_upline', 'survey_hl_month', 'survey_hl_year',
              'survey_active_club', 'survey_club_month', 'survey_club_year',
              'survey_trainings', 'survey_hear_how', 'survey_hear_detail', 'survey_goal',
              'survey_goal_detail', 'survey_open_response',
            ]
            SYNC_KEYS.forEach(k => { if (row0[k] != null) syncFields[k] = row0[k] })
            await supabase.from('locations').update(syncFields).eq('user_id', user.id)
          }
        }
      } else {
        // Brand new user — pre-fill email
        const baseClub = user.email ? { ...DEFAULT_CLUB, club_email: user.email } : { ...DEFAULT_CLUB }
        setClubs([baseClub])
        if (user.email) setPersonForm(f => ({ ...f, owner_email: user.email }))

        // Check for pending_survey from onboarding
        const { data: uta } = await supabase
          .from('user_terms_acceptance')
          .select('pending_survey')
          .eq('user_id', user.id)
          .single()
        if (uta?.pending_survey) {
          try {
            const survey = JSON.parse(uta.pending_survey)
            // Merge survey fields into person form
            setPersonForm(f => ({ ...f, ...survey }))
            // Also prefill club opened date from onboarding survey
            if (survey.survey_club_month || survey.survey_club_year) {
              setClubs(prev => prev.map((c, i) => i === 0 ? {
                ...c,
                opened_month: survey.survey_club_month || c.opened_month,
                opened_year: survey.survey_club_year || c.opened_year,
              } : c))
            }
          } catch {}
        }
      }
      // Load team info modal settings
      const { data: appS } = await supabase.from('app_settings')
        .select('team_info_modal_enabled, team_info_message, team_info_video_enabled, team_info_video_url, team_creation_min_level')
        .eq('id', 1).single()
      if (appS) setTeamInfoSettings(appS)
      setLoading(false)
    }
    load()
  }, [user])

  function setPersonField(key, value) {
    setPersonForm(f => ({ ...f, [key]: value }))
    if (personErrors[key]) setPersonErrors(e => ({ ...e, [key]: null }))
  }

  function openCrop(file, target) {
    const reader = new FileReader()
    reader.onload = e => { setCropSrc(e.target.result); setCropTarget(target) }
    reader.readAsDataURL(file)
  }

  async function saveCroppedOwnerPhoto(blob) {
    const target = cropTarget
    setCropSrc(null); setCropTarget(null)
    const configs = {
      owner1: { set: setOwnerPhotoUrl, setLoading: setUploadingOwnerPhoto, path: user.id + '/owner-photo.jpg' },
      owner2: { set: setOwner2PhotoUrl, setLoading: setUploadingOwner2Photo, path: user.id + '/owner2-photo.jpg' },
      owner3: { set: setOwner3PhotoUrl, setLoading: setUploadingOwner3Photo, path: user.id + '/owner3-photo.jpg' },
    }
    const cfg = configs[target]
    if (!cfg) return
    cfg.setLoading(true)
    const { error } = await supabase.storage.from('club-photos').upload(cfg.path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (!error) {
      const { data } = supabase.storage.from('club-photos').getPublicUrl(cfg.path)
      cfg.set(data.publicUrl + '?t=' + Date.now())
    }
    cfg.setLoading(false)
  }

  function clearOwner(num) {
    const fields = ['owner' + num + '_first_name', 'owner' + num + '_last_name', 'owner' + num + '_email']
    fields.forEach(k => setPersonField(k, ''))
    if (num === 2) setOwner2PhotoUrl(null)
    if (num === 3) setOwner3PhotoUrl(null)
  }

  async function savePersonFields() {
    // Validate owner required fields
    const e = {}
    if (!personForm.first_name.trim()) e.first_name = 'Required'
    if (!personForm.last_name.trim())  e.last_name  = 'Required'
    if (!personForm.herbalife_level)   e.herbalife_level = 'Please select your level'
    if (showOwner2) {
      if (!personForm.owner2_first_name.trim()) e.owner2_first_name = 'Required'
      if (!personForm.owner2_last_name.trim())  e.owner2_last_name  = 'Required'
    }
    if (showOwner3) {
      if (!personForm.owner3_first_name.trim()) e.owner3_first_name = 'Required'
      if (!personForm.owner3_last_name.trim())  e.owner3_last_name  = 'Required'
    }
    if (Object.keys(e).length > 0) {
      setPersonErrors(e)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    const personRecord = {
      ...personForm,
      owner_photo_url:  ownerPhotoUrl,
      owner2_photo_url: owner2PhotoUrl,
      owner3_photo_url: owner3PhotoUrl,
    }

    // Update all of this user's location rows with the person fields
    const { error } = await supabase
      .from('locations')
      .update(personRecord)
      .eq('user_id', user.id)

    if (error) {
      setPersonErrors({ _general: error.message })
    } else {
      setSavedPersonForm({ ...personForm, _p1: ownerPhotoUrl, _p2: owner2PhotoUrl, _p3: owner3PhotoUrl })
      // Clear pending_survey now that it's been applied
      supabase.from('user_terms_acceptance')
        .update({ pending_survey: null })
        .eq('user_id', user.id)
      setPersonToast('Owner info saved ✓')
      setTimeout(() => setPersonToast(''), 3000)
    }
    setSaving(false)
  }

  function handleAddClub() {
    setShowAddClubPrompt(true)
  }

  function confirmAddClub() {
    setShowAddClubPrompt(false)
    const newIndex = clubs.length
    // Inherit person fields from first club so they carry over to the new row
    const source = clubs[0] || {}
    const personFields = {}
    const INHERIT_KEYS = [
      'first_name', 'last_name', 'owner_email', 'herbalife_level',
      'owner2_first_name', 'owner2_last_name', 'owner2_email', 'owner2_herbalife_level',
      'owner3_first_name', 'owner3_last_name', 'owner3_email', 'owner3_herbalife_level',
      'owner_photo_url', 'owner2_photo_url', 'owner3_photo_url',
    ]
    INHERIT_KEYS.forEach(k => { if (source[k]) personFields[k] = source[k] })
    const newClub = { ...DEFAULT_CLUB, ...personFields, club_index: newIndex }
    setClubs(prev => [...prev, newClub])
    setActiveTab(newIndex)
  }

  function handleClubSaved(savedRow) {
    // Update the clubs array with the full saved row
    setClubs(prev => prev.map((c, i) =>
      i === activeTab ? { ...c, ...savedRow } : c
    ))
  }

  function handleClubRemoved(tabIndex) {
    setClubs(prev => {
      const updated = prev.filter((_, i) => i !== tabIndex)
      return updated
    })
    setActiveTab(Math.max(0, tabIndex - 1))
  }

  if (loading) return <div className="loading">Loading profile…</div>

  const hasAnyClub = clubs.some(c => c.id)

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>{hasAnyClub ? 'My Profile' : 'Set Up Your Club'}</h2>
        <p className="profile-sub">{hasAnyClub ? 'Update your club info below.' : 'Fill out your profile to appear on the map.'}</p>
      </div>

      {/* CARD 1: Owners */}
      <div className="sec-card">
        <div className="sec-card-band">
          <span className="sec-label">Owners</span>
        </div>
        <div className="sec-card-body">
        {personErrors._general && <div className="error-msg">{personErrors._general}</div>}

        {/* Owner 1 — Primary Owner */}
        <div className="owner2-block">
          <div className="owner2-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {owner1Collapsed && (
                <div className="owner-collapsed-avatar">
                  {ownerPhotoUrl
                    ? <img src={ownerPhotoUrl} alt="Primary Owner" />
                    : <span>👤</span>
                  }
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 1 }}>Primary Owner</div>
                {owner1Collapsed && (personForm.first_name || personForm.last_name) && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                    {[personForm.first_name, personForm.last_name].filter(Boolean).join(' ')}
                  </div>
                )}
              </div>
            </div>
            <button className="owner2-remove" style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => setOwner1Collapsed(c => !c)}>
              {owner1Collapsed ? '▼ Expand' : '▲ Collapse'}
            </button>
          </div>
          {!owner1Collapsed && (
            <div style={{ padding: '12px 14px' }}>
              <div className="fgrid">
              <div className="pf">
                <label>First name <span className="req-star">*</span></label>
                <input type="text" name="first_name" value={personForm.first_name} onChange={e => setPersonField('first_name', e.target.value)}
                  placeholder="First name" className={personErrors.first_name ? 'input-err' : ''} />
                {personErrors.first_name && <span className="field-err">{personErrors.first_name}</span>}
              </div>
              <div className="pf">
                <label>Last name <span className="req-star">*</span></label>
                <input type="text" name="last_name" value={personForm.last_name} onChange={e => setPersonField('last_name', e.target.value)}
                  placeholder="Last name" className={personErrors.last_name ? 'input-err' : ''} />
                {personErrors.last_name && <span className="field-err">{personErrors.last_name}</span>}
              </div>
            </div>
            <div className="pf owner-email-full">
              <label>Email <span className="autofill-hint">linked to account</span></label>
              <input type="email" name="owner_email" value={personForm.owner_email}
                readOnly tabIndex={-1}
                style={{ background: '#f8faf9', color: '#555', cursor: 'default', borderColor: '#dde8e0' }} />
            </div>
            <OwnerPhotoUpload
              label="Primary Owner"
              photoUrl={ownerPhotoUrl}
              onUpload={e => {
                const file = e.target.files && e.target.files[0]
                if (!file) return
                openCrop(file, 'owner1')
                e.target.value = ''
              }}
              uploading={uploadingOwnerPhoto}
            />
            <div className="pf" style={{ marginTop: 12 }}>
              <label>Herbalife Level <span className="req-star">*</span></label>
              <p className="upload-hint" style={{ marginBottom: 6 }}>Select your current level in the Herbalife sales &amp; marketing plan.</p>
              <OwnerLevelPicker
                value={personForm.herbalife_level}
                onChange={v => setPersonField('herbalife_level', v)}
              />
              {personErrors.herbalife_level && <span className="field-err">{personErrors.herbalife_level}</span>}
            </div>
            </div>
          )}
        </div>

        {/* Owner 2 */}
        {showOwner2 && (
          <div className="owner2-block">
            <div className="owner2-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {owner2Collapsed && (
                  <div className="owner-collapsed-avatar">
                    {owner2PhotoUrl
                      ? <img src={owner2PhotoUrl} alt="Owner 2" />
                      : <span>👤</span>
                    }
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 1 }}>Owner 2</div>
                  {owner2Collapsed && (personForm.owner2_first_name || personForm.owner2_last_name) && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {[personForm.owner2_first_name, personForm.owner2_last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="owner2-remove" style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
                  onClick={() => setOwner2Collapsed(c => !c)}>
                  {owner2Collapsed ? '▼ Expand' : '▲ Collapse'}
                </button>
                <button className="owner2-remove" onClick={() => { setShowOwner2(false); clearOwner(2) }}>Remove</button>
              </div>
            </div>
            {!owner2Collapsed && (
              <>
                <div className="fgrid">
                  <div className="pf">
                    <label>First name <span className="req-star">*</span></label>
                    <input type="text" value={personForm.owner2_first_name} onChange={e => setPersonField('owner2_first_name', e.target.value)}
                      placeholder="First name" className={personErrors.owner2_first_name ? 'input-err' : ''} />
                    {personErrors.owner2_first_name && <span className="field-err">{personErrors.owner2_first_name}</span>}
                  </div>
                  <div className="pf">
                    <label>Last name <span className="req-star">*</span></label>
                    <input type="text" value={personForm.owner2_last_name} onChange={e => setPersonField('owner2_last_name', e.target.value)}
                      placeholder="Last name" className={personErrors.owner2_last_name ? 'input-err' : ''} />
                    {personErrors.owner2_last_name && <span className="field-err">{personErrors.owner2_last_name}</span>}
                  </div>
                </div>
                <div className="pf owner-email-full">
                  <label>Email <span className="optional-tag">optional</span></label>
                  <input type="email" value={personForm.owner2_email} onChange={e => setPersonField('owner2_email', e.target.value)}
                    placeholder="owner2@email.com" />
                </div>
                <OwnerPhotoUpload
                  label="Owner 2"
                  photoUrl={owner2PhotoUrl}
                  onUpload={e => {
                    const file = e.target.files && e.target.files[0]
                    if (!file) return
                    openCrop(file, 'owner2')
                    e.target.value = ''
                  }}
                  uploading={uploadingOwner2Photo}
                />
                <div className="pf" style={{ marginTop: 8 }}>
                  <label>Herbalife Level <span className="optional-tag">optional</span></label>
                  <OwnerLevelPicker
                    value={personForm.owner2_herbalife_level}
                    onChange={v => setPersonField('owner2_herbalife_level', v)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Owner 3 */}
        {showOwner3 && (
          <div className="owner2-block">
            <div className="owner2-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {owner3Collapsed && (
                  <div className="owner-collapsed-avatar">
                    {owner3PhotoUrl
                      ? <img src={owner3PhotoUrl} alt="Owner 3" />
                      : <span>👤</span>
                    }
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginBottom: 1 }}>Owner 3</div>
                  {owner3Collapsed && (personForm.owner3_first_name || personForm.owner3_last_name) && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {[personForm.owner3_first_name, personForm.owner3_last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="owner2-remove" style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
                  onClick={() => setOwner3Collapsed(c => !c)}>
                  {owner3Collapsed ? '▼ Expand' : '▲ Collapse'}
                </button>
                <button className="owner2-remove" onClick={() => { setShowOwner3(false); clearOwner(3) }}>Remove</button>
              </div>
            </div>
            {!owner3Collapsed && (
              <>
                <div className="fgrid">
                  <div className="pf">
                    <label>First name <span className="req-star">*</span></label>
                    <input type="text" value={personForm.owner3_first_name} onChange={e => setPersonField('owner3_first_name', e.target.value)}
                      placeholder="First name" className={personErrors.owner3_first_name ? 'input-err' : ''} />
                    {personErrors.owner3_first_name && <span className="field-err">{personErrors.owner3_first_name}</span>}
                  </div>
                  <div className="pf">
                    <label>Last name <span className="req-star">*</span></label>
                    <input type="text" value={personForm.owner3_last_name} onChange={e => setPersonField('owner3_last_name', e.target.value)}
                      placeholder="Last name" className={personErrors.owner3_last_name ? 'input-err' : ''} />
                    {personErrors.owner3_last_name && <span className="field-err">{personErrors.owner3_last_name}</span>}
                  </div>
                </div>
                <div className="pf owner-email-full">
                  <label>Email <span className="optional-tag">optional</span></label>
                  <input type="email" value={personForm.owner3_email} onChange={e => setPersonField('owner3_email', e.target.value)}
                    placeholder="owner3@email.com" />
                </div>
                <OwnerPhotoUpload
                  label="Owner 3"
                  photoUrl={owner3PhotoUrl}
                  onUpload={e => {
                    const file = e.target.files && e.target.files[0]
                    if (!file) return
                    openCrop(file, 'owner3')
                    e.target.value = ''
                  }}
                  uploading={uploadingOwner3Photo}
                />
                <div className="pf" style={{ marginTop: 8 }}>
                  <label>Herbalife Level <span className="optional-tag">optional</span></label>
                  <OwnerLevelPicker
                    value={personForm.owner3_herbalife_level}
                    onChange={v => setPersonField('owner3_herbalife_level', v)}
                  />
                </div>
              </>
            )}
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

        {/* Owner save bar — sticky when dirty */}
        {hasAnyClub && (
          <div className={`owner-save-bar${isPersonDirty ? ' owner-save-bar--sticky' : ''}`}>
            {isPersonDirty && (
              <div className="save-bar-alert">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#B45309" strokeWidth="1.5"/>
                  <path d="M8 5v4" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="#B45309"/>
                </svg>
                Unsaved changes
              </div>
            )}
            <button className="btn-save" onClick={savePersonFields} disabled={saving || !isPersonDirty || !personForm.first_name.trim() || !personForm.last_name.trim() || !personForm.herbalife_level}>
              {saving ? 'Saving…' : 'Save Owner Info'}
            </button>
          </div>
        )}
        </div>{/* end sec-card-body */}
        <div className="next-card-row">
          <button className="next-card-btn" type="button" onClick={() => {
            setMyClubsOpen(true)
            setTimeout(() => document.querySelector('.my-clubs-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }}>
            Next: My Clubs
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Owner crop modal */}
      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          onSave={saveCroppedOwnerPhoto}
          onCancel={() => { setCropSrc(null); setCropTarget(null) }}
        />
      )}

      {/* CARD 2: My Clubs — tabbed */}
      <div className="sec-card my-clubs-card">
        <button type="button" className="sec-card-band" onClick={() => setMyClubsOpen(o => !o)} style={{ cursor: 'pointer', width: '100%', border: 'none' }}>
          <span className="sec-label">My Clubs</span>
          <svg className={`survey-chevron ${myClubsOpen ? 'open' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        {myClubsOpen && (<>
        {/* Tab row */}
        <div className="club-tabs">
          {clubs.map((club, i) => (
            <button
              key={i}
              className={`club-tab ${activeTab === i ? 'active' : ''}`}
              tabIndex={-1}
              onClick={() => setActiveTab(i)}
            >
              <span className="club-tab-name">
                {club.club_name?.trim() || (i === 0 ? 'My Club' : `Club ${i + 1}`)}
              </span>
              {club.id && <span className="club-tab-dot" />}
            </button>
          ))}
          {clubs.length < 3 && (
            <button className="club-tab club-tab--add" tabIndex={-1} onClick={handleAddClub}>
              + Add Club
            </button>
          )}
        </div>

        {/* Active club editor */}
        {clubs[activeTab] && (
          <ClubEditor
            key={activeTab + '-' + (clubs[activeTab].id || 'new')}
            club={clubs[activeTab]}
            clubIndex={activeTab}
            userId={user.id}
            isOnly={clubs.length === 1}
            allClubs={clubs}
            onSaved={handleClubSaved}
            onRemove={() => handleClubRemoved(activeTab)}
            userEmail={!clubs[activeTab].id && activeTab === 0 ? user.email : null}
            personData={personForm}
          />
        )}
        </>)}
        <div className="next-card-row">
          <button className="next-card-btn" type="button" onClick={() => {
            setMyClubsOpen(false)
            setStoryOpen(true)
            setTimeout(() => document.querySelector('.story-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
          }}>
            <span>Next: Your Story</span><span className="next-card-optional">optional</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      {showAddClubPrompt && (
        <AddClubPrompt
          clubCount={clubs.length}
          onConfirm={confirmAddClub}
          onCancel={() => setShowAddClubPrompt(false)}
        />
      )}

      {/* CARD: Your Story */}
      {(() => {
        const STORY_FIELDS = [
          { key: 'story_why',               label: 'Why did you decide to open your club?' },
          { key: 'story_favorite_part',     label: 'What is your favorite part of club ownership?' },
          { key: 'story_before',            label: 'What did you do for work (your former occupation) before owning your club?' },
          { key: 'story_goal',              label: 'What is your next big goal in Herbalife?' },
          { key: 'story_favorite_products', label: 'What are your favorite products?' },
          { key: 'story_unique',            label: 'What is something unique and interesting about yourself?' },
        ]
        const filledCount = STORY_FIELDS.filter(({ key }) => !!personForm[key]).length
        const storyComplete = filledCount === STORY_FIELDS.length
        return (
          <div className="sec-card story-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button type="button" className="survey-toggle-btn" onClick={() => setStoryOpen(o => !o)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className="sec-label" style={{ margin: 0 }}>Your Story</span>
                {storyComplete
                  ? <span className="survey-complete-badge">Complete</span>
                  : filledCount > 0
                    ? <span className="survey-progress-badge">{filledCount} of 6 filled</span>
                    : <span className="survey-progress-badge optional-tag">all optional</span>
                }
              </div>
              <svg className={'survey-chevron' + (storyOpen ? ' open' : '')} width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {storyOpen && (
              <div style={{ padding: '0 1.5rem 1.25rem' }}>
                <p className="story-intro" style={{ marginTop: 8 }}>Share a little about yourself and your club. These may be shown on your club's profile page.</p>
                {STORY_FIELDS.map(({ key, label }) => (
                  <div className="pf story-field" key={key}>
                    <label>{label}</label>
                    <textarea rows={3} value={personForm[key] || ''} onChange={e => setPersonField(key, e.target.value)}
                      placeholder="Share your answer here…" />
                  </div>
                ))}
                <div className="next-card-row">
                  <button className="next-card-btn" type="button" onClick={() => {
                    setStoryOpen(false)
                    setSurveyOpen(true)
                    setTimeout(() => document.querySelector('.survey-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                  }}>
                    <span>Next: Member Survey</span><span className="next-card-optional">optional</span>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* CARD: Member Survey */}
      {(() => {
        const isActiveClub = personForm.survey_active_club === true || personForm.survey_active_club === 'true'
        const { answered: answeredCount, total: surveyTotal } = countAnswered(personForm)
        const surveyComplete = answeredCount === surveyTotal
        const tSet = new Set((personForm.survey_trainings || '').split(',').filter(Boolean))
        const toggleSurveyTraining = (val) => {
          const newCsv = toggleTrainingValue(personForm.survey_trainings || '', val)
          setPersonField('survey_trainings', newCsv)
        }
        const unfilled = (val) => !val ? 'survey-unfilled' : ''
        return (
          <div className="sec-card survey-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button type="button" className="survey-toggle-btn" onClick={() => setSurveyOpen(o => !o)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span className="sec-label" style={{ margin: 0 }}>Member Survey</span>
                {surveyComplete
                  ? <span className="survey-complete-badge">Complete</span>
                  : <span className="survey-progress-badge survey-progress-warn">{answeredCount} of {surveyTotal} answered</span>
                }
              </div>
              <svg className={'survey-chevron' + (surveyOpen ? ' open' : '')} width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {surveyOpen && (
              <div style={{ padding: '0 1.5rem 1.25rem' }}>
                <p className="upload-hint" style={{ marginBottom: 14, marginTop: 8 }}>
                  Help us get to know you better. All questions are optional but appreciated.
                </p>

                {/* Q1: Upline */}
                <div className={`pf story-field ${unfilled(personForm.survey_upline)}`}>
                  <label>Who is your upline or sponsor?</label>
                  <input type="text" value={personForm.survey_upline || ''} onChange={e => setPersonField('survey_upline', e.target.value)} placeholder="Full name" />
                </div>

                {/* Q2: When did you join */}
                <div className={`pf story-field ${unfilled(personForm.survey_hl_year)}`}>
                  <label>When did you join Herbalife?</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={personForm.survey_hl_month || ''} onChange={e => setPersonField('survey_hl_month', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                      <option value="">Month (optional)</option>
                      {SURVEY_MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select value={personForm.survey_hl_year || ''} onChange={e => setPersonField('survey_hl_year', e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                      <option value="">Year</option>
                      {SURVEY_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Q3: Active club */}
                <div className={`pf story-field ${personForm.survey_active_club === null || personForm.survey_active_club === '' || personForm.survey_active_club === undefined ? 'survey-unfilled' : ''}`}>
                  <label>Are you actively operating a nutrition club?</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button"
                      style={{ flex: 1, padding: '9px', border: '1px solid ' + (isActiveClub ? '#4CAF82' : '#c8d4cc'),
                        borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        background: isActiveClub ? '#E1F5EE' : 'transparent', color: isActiveClub ? '#0F6E56' : '#555' }}
                      onClick={() => setPersonField('survey_active_club', true)}>Yes</button>
                    <button type="button"
                      style={{ flex: 1, padding: '9px', border: '1px solid ' + (personForm.survey_active_club === false || personForm.survey_active_club === 'false' ? '#E24B4A' : '#c8d4cc'),
                        borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                        background: personForm.survey_active_club === false || personForm.survey_active_club === 'false' ? '#FCEBEB' : 'transparent',
                        color: personForm.survey_active_club === false || personForm.survey_active_club === 'false' ? '#A32D2D' : '#555' }}
                      onClick={() => setPersonField('survey_active_club', false)}>No</button>
                  </div>
                </div>

                {/* Q3 follow-up: When did you open */}
                {isActiveClub && (
                  <div className={`pf story-field ${unfilled(personForm.survey_club_year)}`}>
                    <label>When did you open your club?</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={personForm.survey_club_month || ''} onChange={e => setPersonField('survey_club_month', e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                        <option value="">Month</option>
                        {SURVEY_MONTHS.map((m,i) => <option key={i} value={m}>{m}</option>)}
                      </select>
                      <select value={personForm.survey_club_year || ''} onChange={e => setPersonField('survey_club_year', e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #c8d4cc', borderRadius: 8, fontSize: 14 }}>
                        <option value="">Year</option>
                        {SURVEY_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Q4: Trainings */}
                <div className={`pf story-field ${unfilled(personForm.survey_trainings)}`}>
                  <label>Do you actively attend trainings and events?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {TRAINING_OPTIONS.map(({ value, label }) => (
                      <div key={value}
                        onClick={() => toggleSurveyTraining(value)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px',
                          border: '1px solid ' + (tSet.has(value) ? '#4CAF82' : '#c8d4cc'),
                          borderRadius: 8, cursor: 'pointer',
                          background: tSet.has(value) ? '#f5fdf8' : 'transparent' }}>
                        <div style={{ width: 16, height: 16, border: '1.5px solid ' + (tSet.has(value) ? '#4CAF82' : '#c8d4cc'),
                          borderRadius: 4, flexShrink: 0, marginTop: 1,
                          background: tSet.has(value) ? '#4CAF82' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {tSet.has(value) && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 13, lineHeight: 1.4 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Q5: How did you hear */}
                <div className={`pf story-field ${unfilled(personForm.survey_hear_how)}`}>
                  <label>How did you hear about this platform?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {HEAR_HOW_OPTIONS.map(({ value, label, hasInput }) => (
                      <div key={value}>
                        <div onClick={() => { setPersonField('survey_hear_how', value); if (!hasInput) setPersonField('survey_hear_detail', '') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                            border: '1px solid ' + (personForm.survey_hear_how === value ? '#4CAF82' : '#c8d4cc'),
                            borderRadius: personForm.survey_hear_how === value && hasInput ? '8px 8px 0 0' : '8px',
                            cursor: 'pointer', background: personForm.survey_hear_how === value ? '#f5fdf8' : 'transparent' }}>
                          <div style={{ width: 16, height: 16, border: '1.5px solid ' + (personForm.survey_hear_how === value ? '#4CAF82' : '#c8d4cc'),
                            borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {personForm.survey_hear_how === value && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF82' }} />
                            )}
                          </div>
                          <span style={{ fontSize: 13 }}>{label}</span>
                        </div>
                        {hasInput && personForm.survey_hear_how === value && (
                          <div style={{ border: '1px solid #4CAF82', borderTop: 'none', borderRadius: '0 0 8px 8px',
                            background: '#f5fdf8', padding: '8px 12px' }}>
                            <input type="text" value={personForm.survey_hear_detail || ''}
                              onChange={e => setPersonField('survey_hear_detail', e.target.value)}
                              placeholder="Please share a few details..."
                              style={{ width: '100%', padding: '7px 10px', border: '1px solid #c8d4cc',
                                borderRadius: 6, fontSize: 13 }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Q6: Primary goal — multiple choice */}
                <div className={`pf story-field ${unfilled(personForm.survey_goal)}`}>
                  <label>What is your primary goal for joining this platform?</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {GOAL_OPTIONS.map(({ value, label }) => (
                      <div key={value}>
                        <div onClick={() => { setPersonField('survey_goal', value); if (value !== 'other') setPersonField('survey_goal_detail', '') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                            border: '1px solid ' + (personForm.survey_goal === value ? '#4CAF82' : '#c8d4cc'),
                            borderRadius: personForm.survey_goal === value && value === 'other' ? '8px 8px 0 0' : '8px',
                            cursor: 'pointer', background: personForm.survey_goal === value ? '#f5fdf8' : 'transparent' }}>
                          <div style={{ width: 16, height: 16, border: '1.5px solid ' + (personForm.survey_goal === value ? '#4CAF82' : '#c8d4cc'),
                            borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {personForm.survey_goal === value && (
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF82' }} />
                            )}
                          </div>
                          <span style={{ fontSize: 13 }}>{label}</span>
                        </div>
                        {value === 'other' && personForm.survey_goal === 'other' && (
                          <div style={{ border: '1px solid #4CAF82', borderTop: 'none', borderRadius: '0 0 8px 8px',
                            background: '#f5fdf8', padding: '8px 12px' }}>
                            <input type="text" value={personForm.survey_goal_detail || ''}
                              onChange={e => setPersonField('survey_goal_detail', e.target.value)}
                              placeholder="Tell us more…"
                              style={{ width: '100%', padding: '7px 10px', border: '1px solid #c8d4cc',
                                borderRadius: 6, fontSize: 13 }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Q7: Open response */}
                <div className={`pf story-field ${unfilled(personForm.survey_open_response)}`}>
                  <label>Anything else you'd like to share?</label>
                  <textarea rows={3} value={personForm.survey_open_response || ''} onChange={e => setPersonField('survey_open_response', e.target.value)}
                    placeholder="Your Herbalife journey, hopes for this platform, anything on your mind…" />
                </div>
                <div className="next-card-row">
                  {meetsTeamLevel ? (
                    <button className="next-card-btn" type="button" onClick={() => {
                      setSurveyOpen(false)
                      if (teamInfoSettings?.team_info_modal_enabled && !localStorage.getItem(`team_info_seen_${user?.id}`)) {
                        setShowTeamInfoModal(true)
                      }
                      setTimeout(() => document.querySelector('.my-team-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
                    }}>
                      <span>Next: My Team</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  ) : (
                    <button className="next-card-btn next-card-btn--primary" type="button" onClick={() => {
                      setSurveyOpen(false)
                      setShowReviewModal(true)
                    }}>
                      <span>Save & Review</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ height: 32 }} />

      {/* My Team — only shown if user meets min level */}
      {meetsTeamLevel && (<>
        <div style={{ height: 32 }} />
        <MyTeamSection userId={user?.id} userLevel={personForm.herbalife_level} />
        <div className="next-card-row" style={{ marginTop: 16 }}>
          <button className="next-card-btn next-card-btn--primary" type="button" onClick={() => setShowReviewModal(true)}>
            <span>Save & Review</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </>)}

      <div style={{ height: 32 }} />
      <div className="profile-privacy-link">
        <a href="/privacy" target="_blank" rel="noreferrer">Privacy & Use Policy</a>
      </div>

      {/* Review Modal */}
      {showReviewModal && (() => {
        const club = clubs[0] || {}
        const DAY_LABELS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        const hoursRows = DAYS.map((d, i) => {
          const o = club['hours_' + d + '_open'], c = club['hours_' + d + '_close']
          return o && c ? { day: DAY_LABELS_SHORT[i], hours: `${o} – ${c}` } : null
        }).filter(Boolean)

        async function handleApproveAndGo() {
          // Build full record from person form + first club
          const club0 = clubs[0] || {}
          const personRecord = {
            ...personForm,
            approved: true,
            owner_photo_url: ownerPhotoUrl,
            owner2_photo_url: owner2PhotoUrl,
            owner3_photo_url: owner3PhotoUrl,
          }

          // Check if locations row exists
          const { data: existingLocs } = await supabase.from('locations').select('id').eq('user_id', user.id)

          if (existingLocs && existingLocs.length > 0) {
            // Update all existing location rows with person + approval
            await supabase.from('locations').update(personRecord).eq('user_id', user.id)
          } else if (club0.club_name && club0.address) {
            // No location row yet — create one with club + person data
            const { data: appSettings } = await supabase.from('app_settings').select('require_approval').eq('id', 1).single()
            const newRecord = {
              user_id: user.id,
              club_index: 0,
              ...club0,
              ...personRecord,
              approved: appSettings?.require_approval ? false : true,
              state_zip: ((club0.state || '') + ' ' + (club0.zip || '')).trim(),
            }
            delete newRecord.id
            await supabase.from('locations').insert(newRecord)
          }

          // Clear pending_survey
          await supabase.from('user_terms_acceptance').update({ pending_survey: null }).eq('user_id', user.id)

          setSavedPersonForm({ ...personForm, _p1: ownerPhotoUrl, _p2: owner2PhotoUrl, _p3: owner3PhotoUrl })
          setShowReviewModal(false)
          navigate('/app/map')
        }

        return (
          <div className="modal-overlay">
            <div className="modal-box review-modal" onClick={e => e.stopPropagation()}>
              <div className="review-modal-header">
                <div className="review-modal-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M9 11l3 3L22 4" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="review-modal-title">Review Your Profile</h3>
              </div>
              <div className="review-modal-body">
                <p className="review-modal-intro">Take a moment to review everything before going live on the map.</p>

                {/* Owner info */}
                <div className="review-section">
                  <div className="review-section-label">Owner</div>
                  <div className="review-row"><span className="review-key">Name</span><span>{[personForm.first_name, personForm.last_name].filter(Boolean).join(' ') || '—'}</span></div>
                  <div className="review-row"><span className="review-key">Email</span><span>{personForm.owner_email || '—'}</span></div>
                  <div className="review-row"><span className="review-key">Level</span><span>{personForm.herbalife_level || '—'}</span></div>
                </div>

                {/* Club info */}
                <div className="review-section">
                  <div className="review-section-label">Club — {club.club_name || 'Unnamed'}</div>
                  <div className="review-row"><span className="review-key">Address</span><span>{[club.address, club.city, club.state, club.zip].filter(Boolean).join(', ') || '—'}</span></div>
                  <div className="review-row"><span className="review-key">Phone</span><span>{club.club_phone || '—'}</span></div>
                  <div className="review-row"><span className="review-key">Email</span><span>{club.club_email || '—'}</span></div>
                  <div className="review-row"><span className="review-key">Opened</span><span>{club.opened_month && club.opened_year ? `${club.opened_month} ${club.opened_year}` : '—'}</span></div>
                  {hoursRows.length > 0 && (
                    <div className="review-row review-row--top"><span className="review-key">Hours</span>
                      <div>{hoursRows.map(r => <div key={r.day} style={{ fontSize: 12.5 }}><strong>{r.day}</strong> {r.hours}</div>)}</div>
                    </div>
                  )}
                </div>

                {/* Socials */}
                {(club.social_facebook || club.social_instagram || club.social_tiktok || club.social_youtube || club.website) && (
                  <div className="review-section">
                    <div className="review-section-label">Social & Website</div>
                    {club.website && <div className="review-row"><span className="review-key">Website</span><span>{club.website}</span></div>}
                    {club.social_facebook && <div className="review-row"><span className="review-key">Facebook</span><span>✓</span></div>}
                    {club.social_instagram && <div className="review-row"><span className="review-key">Instagram</span><span>✓</span></div>}
                    {club.social_tiktok && <div className="review-row"><span className="review-key">TikTok</span><span>✓</span></div>}
                    {club.social_youtube && <div className="review-row"><span className="review-key">YouTube</span><span>✓</span></div>}
                  </div>
                )}

                {/* Additional clubs */}
                {clubs.length > 1 && (
                  <div className="review-section">
                    <div className="review-section-label">{clubs.length} Clubs Total</div>
                    {clubs.slice(1).map((c, i) => (
                      <div key={i} className="review-row"><span className="review-key">Club {i + 2}</span><span>{c.club_name || 'Unnamed'} — {c.city}{c.state ? `, ${c.state}` : ''}</span></div>
                    ))}
                  </div>
                )}
              </div>

              <div className="review-modal-footer">
                <button className="review-btn review-btn--back" onClick={() => setShowReviewModal(false)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 13l-5-5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Go back & edit
                </button>
                <button className="review-btn review-btn--approve" onClick={handleApproveAndGo}>
                  Approve & go to map
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Team Info Modal */}
      {showTeamInfoModal && teamInfoSettings && (
        <div className="modal-overlay" onClick={() => { setShowTeamInfoModal(false); localStorage.setItem(`team_info_seen_${user?.id}`, 'true') }}>
          <div className="modal-box team-info-modal" onClick={e => e.stopPropagation()}>
            <div className="team-info-modal-header">
              <div className="team-info-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="9" cy="7" r="4" stroke="#4CAF82" strokeWidth="1.5"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#4CAF82" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="team-info-modal-title">What are Teams?</h3>
              <button className="team-info-modal-close" onClick={() => { setShowTeamInfoModal(false); localStorage.setItem(`team_info_seen_${user?.id}`, 'true') }}>✕</button>
            </div>
            <div className="team-info-modal-body rte-content" dangerouslySetInnerHTML={{ __html: teamInfoSettings.team_info_message || '' }} />
            {teamInfoSettings.team_info_video_enabled && teamInfoSettings.team_info_video_url && (
              <div className="team-info-modal-video">
                <iframe src={teamInfoSettings.team_info_video_url} title="Teams explainer" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            )}
            <div className="team-info-modal-footer">
              <button className="auth-btn auth-btn--forest" onClick={() => { setShowTeamInfoModal(false); localStorage.setItem(`team_info_seen_${user?.id}`, 'true') }}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={'toast' + (personToast ? ' show' : '')}>{personToast}</div>
    </div>
  )
}
