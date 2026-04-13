// ═══════════════════════════════════════════════════════
// Shared Survey Config — used by OnboardingPage + ProfilePage Member Survey
// Change questions here and they update everywhere.
// ═══════════════════════════════════════════════════════

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const YEARS  = Array.from({length: new Date().getFullYear() - 1979}, (_,i) => String(new Date().getFullYear()-i))

export const TRAINING_OPTIONS = [
  { value: 'local',    label: 'Local events and trainings (quickstarts, distributor workshops, etc.)' },
  { value: 'zoom',     label: 'Team Zoom calls' },
  { value: 'sts',      label: 'STS (Success Training Seminar)' },
  { value: 'regional', label: 'Regional quarterly events (LDW/FSL, BAE, Amplify/Elevate, etc.)' },
  { value: 'extrav',   label: 'Extravaganza' },
  { value: 'all',      label: 'All of the above' },
]

// All individual training values (everything except 'all')
export const TRAINING_INDIVIDUAL = TRAINING_OPTIONS.filter(o => o.value !== 'all').map(o => o.value)

export const HEAR_HOW_OPTIONS = [
  { value: 'upline',    label: 'A team member or my upline told me',  hasInput: false },
  { value: 'clubowner', label: 'A fellow club owner shared it',       hasInput: false },
  { value: 'zoom',      label: 'Heard about it on a Zoom call',       hasInput: false },
  { value: 'event',     label: 'Heard about it at an event',          hasInput: false },
  { value: 'telegram',  label: 'Learned about it in a Telegram chat', hasInput: false },
  { value: 'other',     label: 'Other',                               hasInput: true },
]

export const GOAL_OPTIONS = [
  { value: 'visibility',   label: 'Get my club more visibility and foot traffic' },
  { value: 'connect',      label: 'Connect with other club owners in my area' },
  { value: 'team',         label: 'Build and organize my team' },
  { value: 'learn',        label: 'Learn from other successful club operators' },
  { value: 'market_data',  label: 'Access market data and demographics' },
  { value: 'support',      label: 'Be part of a supportive club owner community' },
  { value: 'other',        label: 'Other' },
]

// Survey field keys stored in locations table
export const SURVEY_KEYS = [
  'survey_upline', 'survey_hl_month', 'survey_hl_year',
  'survey_active_club', 'survey_club_month', 'survey_club_year',
  'survey_trainings', 'survey_hear_how', 'survey_hear_detail',
  'survey_goal', 'survey_goal_detail', 'survey_open_response',
  'survey_completed_at',
]

// Helper: toggle training value with auto-check "all" logic
export function toggleTrainingValue(currentCsv, val) {
  const set = new Set((currentCsv || '').split(',').filter(Boolean))

  if (val === 'all') {
    if (set.has('all')) set.clear()
    else { set.clear(); set.add('all') }
  } else {
    set.delete('all')
    if (set.has(val)) set.delete(val)
    else set.add(val)
    // Auto-check "all" if every individual option is selected
    const allIndividual = TRAINING_INDIVIDUAL.every(v => set.has(v))
    if (allIndividual) {
      set.clear()
      set.add('all')
    }
  }
  return [...set].join(',')
}

// Helper: count answered survey fields
export function countAnswered(form) {
  const isActiveClub = form.survey_active_club === true || form.survey_active_club === 'true'
  const fields = [
    !!form.survey_upline,
    !!form.survey_hl_year,
    form.survey_active_club !== null && form.survey_active_club !== '' && form.survey_active_club !== undefined,
    isActiveClub ? !!form.survey_club_year : true,
    !!form.survey_trainings,
    !!form.survey_hear_how,
    !!form.survey_goal,
    !!form.survey_open_response,
  ]
  return { answered: fields.filter(Boolean).length, total: fields.length }
}
