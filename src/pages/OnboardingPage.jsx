import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const YEARS  = Array.from({length: new Date().getFullYear() - 1979}, (_,i) => String(new Date().getFullYear()-i))

const CARDS = [
  {id:'welcome'},
  {id:'upline'},
  {id:'hlTenure'},
  {id:'activeClub'},
  {id:'trainings'},
  {id:'hearHow'},
  {id:'goal'},
  {id:'done'},
]

export default function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep]           = useState(0)
  const [upline, setUpline]       = useState('')
  const [hlMonth, setHlMonth]     = useState('')
  const [hlYear, setHlYear]       = useState('')
  const [activeClub, setActiveClub] = useState(null)
  const [clubMonth, setClubMonth] = useState('')
  const [clubYear, setClubYear]   = useState('')
  const [trainings, setTrainings] = useState(new Set())
  const [hearHow, setHearHow]     = useState('')
  const [hearDetail, setHearDetail] = useState('')
  const [goal, setGoal]           = useState('')
  const [saving, setSaving]       = useState(false)

  // If onboarding already done, skip to profile
  useEffect(() => {
    async function check() {
      if (!user) return
      const { data } = await supabase
        .from('user_terms_acceptance')
        .select('onboarding_done')
        .eq('user_id', user.id)
        .single()
      if (data?.onboarding_done) navigate('/app/profile')
    }
    check()
  }, [user])

  const total = CARDS.length - 1

  async function saveSurvey() {
    if (!user) return
    setSaving(true)
    const allFilled = upline && hlYear && activeClub !== null &&
      (activeClub ? clubYear : true) && trainings.size > 0 && hearHow && goal

    const record = {
      survey_upline:       upline     || null,
      survey_hl_month:     hlMonth    || null,
      survey_hl_year:      hlYear     || null,
      survey_active_club:  activeClub,
      survey_club_month:   clubMonth  || null,
      survey_club_year:    clubYear   || null,
      survey_trainings:    trainings.size > 0 ? [...trainings].join(',') : null,
      survey_hear_how:     hearHow    || null,
      survey_hear_detail:  hearDetail || null,
      survey_goal:         goal       || null,
      survey_completed_at: allFilled ? new Date().toISOString() : null,
    }

    // Upsert survey answers into locations if profile exists, else store in user_terms_acceptance as JSON
    const { data: loc } = await supabase.from('locations').select('id').eq('user_id', user.id).single()
    if (loc) {
      await supabase.from('locations').update(record).eq('user_id', user.id)
    } else {
      // Store temporarily in user_terms_acceptance pending_survey column
      await supabase.from('user_terms_acceptance').update({
        pending_survey: JSON.stringify(record)
      }).eq('user_id', user.id)
    }

    // Mark onboarding done
    await supabase.from('user_terms_acceptance').update({ onboarding_done: true }).eq('user_id', user.id)
    setSaving(false)
  }

  function toggleTraining(val) {
    const next = new Set(trainings)
    if (val === 'all') {
      if (next.has('all')) next.clear()
      else { next.clear(); next.add('all') }
    } else {
      next.delete('all')
      if (next.has(val)) next.delete(val)
      else next.add(val)
    }
    setTrainings(next)
  }

  async function handleNext() {
    if (CARDS[step].id === 'done') {
      navigate('/app/profile')
      return
    }
    if (step < CARDS.length - 1) setStep(s => s + 1)
  }

  async function handleSubmit() {
    await saveSurvey()
    setStep(s => s + 1)
  }

  function handleSkip() {
    if (step < CARDS.length - 1) setStep(s => s + 1)
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1)
  }

  const card = CARDS[step]

  return (
    <div className="onb-page">
      <div className="onb-inner">

        {/* Logo */}
        <div className="onb-logo">
          <div className="onb-logo-pin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#fff"/>
            </svg>
          </div>
          <span>My Club Locator</span>
        </div>

        {/* Progress */}
        {card.id !== 'done' && (
          <div className="onb-progress">
            <div className="onb-prog-steps">
              {Array.from({length: total}).map((_, i) => (
                <div key={i} className={`onb-prog-step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
              ))}
            </div>
            <div className="onb-prog-label">Step {step + 1} of {total}</div>
          </div>
        )}

        {/* Card */}
        <div className="onb-card">

          {card.id === 'welcome' && (
            <>
              <div className="onb-eyebrow">Welcome</div>
              <div className="onb-title">Before you set up your club, tell us a little about yourself</div>
              <div className="onb-sub">These questions are all optional and help us understand our community. It only takes a minute.</div>
              <div className="onb-nav onb-nav-right">
                <button className="onb-btn-next" onClick={handleNext}>Get started</button>
              </div>
            </>
          )}

          {card.id === 'upline' && (
            <>
              <div className="onb-eyebrow">Question 1</div>
              <div className="onb-title">Who is your upline or sponsor?</div>
              <div className="onb-sub">The person who brought you into Herbalife or your direct upline in the network.</div>
              <label className="onb-field-label">Upline / sponsor name</label>
              <input className="onb-input" type="text" name="fullname" placeholder="Full name"
                value={upline} onChange={e => setUpline(e.target.value)} />
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="onb-btn-next" onClick={handleNext}>Next</button>
              </div>
            </>
          )}

          {card.id === 'hlTenure' && (
            <>
              <div className="onb-eyebrow">Question 2</div>
              <div className="onb-title">How long have you been a Herbalife member?</div>
              <div className="onb-field-row">
                <select className="onb-select" value={hlMonth} onChange={e => setHlMonth(e.target.value)}>
                  <option value="">Month (optional)</option>
                  {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select className="onb-select" value={hlYear} onChange={e => setHlYear(e.target.value)}>
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="onb-hint">Month is optional — year is enough if you're not sure.</div>
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="onb-btn-next" onClick={handleNext}>Next</button>
              </div>
            </>
          )}

          {card.id === 'activeClub' && (
            <>
              <div className="onb-eyebrow">Question 3</div>
              <div className="onb-title">Are you actively operating a nutrition club?</div>
              <div className="onb-sub">This platform is designed for active club owners.</div>
              <div className="onb-yn-row">
                <button className={`onb-yn yes ${activeClub === true ? 'on' : ''}`} onClick={() => setActiveClub(true)}>Yes</button>
                <button className={`onb-yn no  ${activeClub === false ? 'on' : ''}`} onClick={() => setActiveClub(false)}>No</button>
              </div>
              {activeClub === true && (
                <div className="onb-conditional">
                  <div className="onb-sub" style={{ marginBottom: 8 }}>How long have you been operating your club?</div>
                  <div className="onb-field-row">
                    <select className="onb-select" value={clubMonth} onChange={e => setClubMonth(e.target.value)}>
                      <option value="">Month (optional)</option>
                      {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select className="onb-select" value={clubYear} onChange={e => setClubYear(e.target.value)}>
                      <option value="">Year</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-next" onClick={handleNext} disabled={activeClub === null}>Next</button>
              </div>
            </>
          )}

          {card.id === 'trainings' && (
            <>
              <div className="onb-eyebrow">Question 4</div>
              <div className="onb-title">Do you actively attend trainings and events?</div>
              <div className="onb-sub">Select all that apply.</div>
              <div className="onb-check-list">
                {[
                  ['local', 'Local events and trainings (quickstarts, distributor workshops, etc.)'],
                  ['zoom',  'Team Zoom calls'],
                  ['sts',   'STS (Success Training Seminar)'],
                  ['regional', 'Regional quarterly events (LDW/FSL, BAE, Amplify/Elevate, etc.)'],
                  ['extrav', 'Extravaganza'],
                  ['all',   'All of the above'],
                ].map(([val, lbl]) => (
                  <div key={val} className={`onb-check-item ${trainings.has(val) ? 'on' : ''}`} onClick={() => toggleTraining(val)}>
                    <div className="onb-check-box">
                      {trainings.has(val) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="onb-check-label">{lbl}</span>
                  </div>
                ))}
              </div>
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="onb-btn-next" onClick={handleNext}>Next</button>
              </div>
            </>
          )}

          {card.id === 'hearHow' && (
            <>
              <div className="onb-eyebrow">Question 5</div>
              <div className="onb-title">How did you hear about this platform?</div>
              <div className="onb-radio-list">
                {[
                  ['upline',    'A team member or my upline told me',  false],
                  ['clubowner', 'A fellow club owner shared it',        false],
                  ['zoom',      'Heard about it on a Zoom call',        false],
                  ['event',     'Heard about it at an event',           false],
                  ['other',     'Other',                                true],
                ].map(([val, lbl, hasInput]) => (
                  <div key={val} className="onb-radio-item">
                    <div className={`onb-radio-row ${hearHow === val ? 'on' : ''}`} onClick={() => { setHearHow(val); setHearDetail('') }}>
                      <div className="onb-radio-dot">
                        {hearHow === val && <div className="onb-radio-dot-inner" />}
                      </div>
                      <span className="onb-check-label">{lbl}</span>
                    </div>
                    {hasInput && hearHow === val && (
                      <div className="onb-radio-sub-wrap">
                        <input className="onb-radio-sub-input" type="text"
                          placeholder="Please share a few details…"
                          value={hearDetail} onChange={e => setHearDetail(e.target.value)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="onb-btn-next" onClick={handleNext}>Next</button>
              </div>
            </>
          )}

          {card.id === 'goal' && (
            <>
              <div className="onb-eyebrow">Last question</div>
              <div className="onb-title">What is your primary goal for joining this platform?</div>
              <div className="onb-sub">In your own words — what do you hope to get out of My Club Locator?</div>
              <textarea className="onb-input onb-textarea" rows={4}
                placeholder="Share your thoughts…"
                value={goal} onChange={e => setGoal(e.target.value)} />
              <div className="onb-nav">
                <button className="onb-btn-back" onClick={handleBack}>← Back</button>
                <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="onb-btn-next" onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </>
          )}

          {card.id === 'done' && (
            <>
              <div className="onb-done-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="onb-done-title">You're all set!</div>
              <div className="onb-done-sub">Your application has been submitted for review. You'll have full access once approved — usually within 24 hours.<br /><br />In the meantime, go ahead and set up your club profile.</div>
              <div className="onb-nav onb-nav-right" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '0.5px solid #f0f0f0' }}>
                <button className="onb-btn-next" onClick={handleNext}>Set up my club →</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
