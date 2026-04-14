import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import {
  MONTHS, YEARS, TRAINING_OPTIONS, HEAR_HOW_OPTIONS, GOAL_OPTIONS,
  toggleTrainingValue,
} from '../lib/surveyConfig'

const CARDS = [
  {id:'welcome'},
  {id:'upline'},
  {id:'hlTenure'},
  {id:'activeClub'},
  {id:'trainings'},
  {id:'hearHow'},
  {id:'goal'},
  {id:'openResponse'},
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
  const [goalDetail, setGoalDetail] = useState('')
  const [openResponse, setOpenResponse] = useState('')
  const [saving, setSaving]       = useState(false)
  const [autoApprove, setAutoApprove] = useState(true)

  useEffect(() => {
    async function check() {
      if (!user) return
      const { data } = await supabase
        .from('user_terms_acceptance')
        .select('onboarding_done')
        .eq('user_id', user.id)
        .single()
      if (data?.onboarding_done) navigate('/app/profile')
      const { data: settings } = await supabase.from('app_settings').select('require_approval').eq('id', 1).single()
      if (settings) setAutoApprove(!settings.require_approval)
    }
    check()
  }, [user])

  const total = CARDS.length - 1

  function toggleTraining(val) {
    const csv = [...trainings].join(',')
    const newCsv = toggleTrainingValue(csv, val)
    setTrainings(new Set(newCsv.split(',').filter(Boolean)))
  }

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
      survey_goal_detail:  goalDetail || null,
      survey_open_response: openResponse || null,
      survey_completed_at: allFilled ? new Date().toISOString() : null,
    }

    const { data: loc } = await supabase.from('locations').select('id').eq('user_id', user.id).single()
    if (loc) {
      await supabase.from('locations').update(record).eq('user_id', user.id)
      await supabase.from('user_terms_acceptance').upsert({
        user_id: user.id, onboarding_done: true
      }, { onConflict: 'user_id' })
    } else {
      await supabase.from('user_terms_acceptance').upsert({
        user_id: user.id,
        pending_survey: JSON.stringify(record),
        onboarding_done: true
      }, { onConflict: 'user_id' })
    }
    setSaving(false)
  }

  async function handleNext() {
    if (CARDS[step].id === 'done') { await saveSurvey(); navigate('/app/profile'); return }
    if (step < CARDS.length - 1) setStep(s => s + 1)
  }

  async function handleSubmit() {
    await saveSurvey()
    setStep(s => s + 1)
  }

  async function handleSkip() { await saveSurvey(); if (step < CARDS.length - 1) setStep(s => s + 1) }
  function handleBack() { if (step > 0) setStep(s => s - 1) }

  const card = CARDS[step]

  return (
    <div className="onb-page">
      <div className="onb-inner">
        <div className="onb-logo">
          <div className="onb-logo-pin">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3.5" fill="#fff"/><circle cx="9" cy="9" r="7" stroke="#fff" strokeWidth="1.5" fill="none"/><line x1="9" y1="2" x2="9" y2="0.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="16" x2="9" y2="17.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="2" y1="9" x2="0.5" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="9" x2="17.5" y2="9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <span>My Club Locator</span>
        </div>

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

        <div className="onb-card">

          {card.id === 'welcome' && (<>
            <div className="onb-eyebrow">Welcome</div>
            <div className="onb-title">Before you set up your club, tell us a little about yourself</div>
            <div className="onb-sub">These questions are all optional and help us understand our community. It only takes a minute.</div>
            <div className="onb-nav onb-nav-right">
              <button className="onb-btn-next" onClick={handleNext}>Get started</button>
            </div>
          </>)}

          {card.id === 'upline' && (<>
            <div className="onb-eyebrow">Question 1</div>
            <div className="onb-title">Who is your upline or sponsor?</div>
            <div className="onb-sub">The person who brought you into Herbalife or your direct upline in the network.</div>
            <label className="onb-field-label">Upline / sponsor name</label>
            <input className={`onb-input ${upline ? 'onb-filled' : ''}`} type="text" name="fullname" placeholder="Full name"
              value={upline} onChange={e => setUpline(e.target.value)} />
            <div className="onb-nav">
              <button className="onb-btn-back" onClick={handleBack}>← Back</button>
              <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
              <button className="onb-btn-next" onClick={handleNext}>Next</button>
            </div>
          </>)}

          {card.id === 'hlTenure' && (<>
            <div className="onb-eyebrow">Question 2</div>
            <div className="onb-title">When did you join Herbalife?</div>
            <div className="onb-sub">Select the month and year you became a Herbalife distributor.</div>
            <div className="onb-field-row">
              <select className={`onb-select ${hlMonth ? 'onb-filled' : ''}`} value={hlMonth} onChange={e => setHlMonth(e.target.value)}>
                <option value="">Month (optional)</option>
                {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className={`onb-select ${hlYear ? 'onb-filled' : ''}`} value={hlYear} onChange={e => setHlYear(e.target.value)}>
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
          </>)}

          {card.id === 'activeClub' && (<>
            <div className="onb-eyebrow">Question 3</div>
            <div className="onb-title">Are you actively operating a nutrition club?</div>
            <div className="onb-sub">This platform is designed for active club owners.</div>
            <div className="onb-yn-row">
              <button className={`onb-yn yes ${activeClub === true ? 'on' : ''}`} onClick={() => setActiveClub(true)}>Yes</button>
              <button className={`onb-yn no  ${activeClub === false ? 'on' : ''}`} onClick={() => setActiveClub(false)}>No</button>
            </div>
            {activeClub === true && (
              <div className="onb-conditional">
                <div className="onb-sub" style={{ marginBottom: 8 }}>When did you open your club?</div>
                <div className="onb-hint" style={{ marginBottom: 8 }}>Select the month and year your club first opened its doors.</div>
                <div className="onb-field-row">
                  <select className={`onb-select ${clubMonth ? 'onb-filled' : ''}`} value={clubMonth} onChange={e => setClubMonth(e.target.value)}>
                    <option value="">Month</option>
                    {MONTHS.map((m,i) => <option key={i} value={m}>{m}</option>)}
                  </select>
                  <select className={`onb-select ${clubYear ? 'onb-filled' : ''}`} value={clubYear} onChange={e => setClubYear(e.target.value)}>
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
          </>)}

          {card.id === 'trainings' && (<>
            <div className="onb-eyebrow">Question 4</div>
            <div className="onb-title">Do you actively attend trainings and events?</div>
            <div className="onb-sub">Select all that apply.</div>
            <div className="onb-check-list">
              {TRAINING_OPTIONS.map(({ value, label }) => (
                <div key={value} className={`onb-check-item ${trainings.has(value) ? 'on' : ''}`} onClick={() => toggleTraining(value)}>
                  <div className="onb-check-box">
                    {trainings.has(value) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                  <span className="onb-check-label">{label}</span>
                </div>
              ))}
            </div>
            <div className="onb-nav">
              <button className="onb-btn-back" onClick={handleBack}>← Back</button>
              <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
              <button className="onb-btn-next" onClick={handleNext}>Next</button>
            </div>
          </>)}

          {card.id === 'hearHow' && (<>
            <div className="onb-eyebrow">Question 5</div>
            <div className="onb-title">How did you hear about this platform?</div>
            <div className="onb-radio-list">
              {HEAR_HOW_OPTIONS.map(({ value, label, hasInput }) => (
                <div key={value} className="onb-radio-item">
                  <div className={`onb-radio-row ${hearHow === value ? 'on' : ''}`} onClick={() => { setHearHow(value); if (!hasInput) setHearDetail('') }}>
                    <div className="onb-radio-dot">{hearHow === value && <div className="onb-radio-dot-inner" />}</div>
                    <span className="onb-check-label">{label}</span>
                  </div>
                  {hasInput && hearHow === value && (
                    <div className="onb-radio-sub-wrap">
                      <input className="onb-radio-sub-input" type="text" placeholder="Please share a few details…"
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
          </>)}

          {card.id === 'goal' && (<>
            <div className="onb-eyebrow">Question 6</div>
            <div className="onb-title">What is your primary goal for joining this platform?</div>
            <div className="onb-sub">Select the option that best describes what you're looking for.</div>
            <div className="onb-radio-list">
              {GOAL_OPTIONS.map(({ value, label }) => (
                <div key={value} className="onb-radio-item">
                  <div className={`onb-radio-row ${goal === value ? 'on' : ''}`} onClick={() => { setGoal(value); if (value !== 'other') setGoalDetail('') }}>
                    <div className="onb-radio-dot">{goal === value && <div className="onb-radio-dot-inner" />}</div>
                    <span className="onb-check-label">{label}</span>
                  </div>
                  {value === 'other' && goal === 'other' && (
                    <div className="onb-radio-sub-wrap">
                      <input className="onb-radio-sub-input" type="text" placeholder="Tell us more…"
                        value={goalDetail} onChange={e => setGoalDetail(e.target.value)} />
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
          </>)}

          {card.id === 'openResponse' && (<>
            <div className="onb-eyebrow">Last question</div>
            <div className="onb-title">Anything else you'd like to share?</div>
            <div className="onb-sub">Tell us about your Herbalife journey so far, what excites you about this platform, or anything else on your mind. Totally optional!</div>
            <textarea className={`onb-input onb-textarea ${openResponse ? 'onb-filled' : ''}`} rows={4}
              placeholder="Share your thoughts…"
              value={openResponse} onChange={e => setOpenResponse(e.target.value)} />
            <div className="onb-nav">
              <button className="onb-btn-back" onClick={handleBack}>← Back</button>
              <button className="onb-btn-skip" onClick={handleSkip}>Skip</button>
              <button className="onb-btn-next" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </>)}

          {card.id === 'done' && (<>
            <div className="onb-done-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {autoApprove ? (
              <>
                <div className="onb-done-title">Welcome aboard!</div>
                <div className="onb-done-sub">Your answers have been saved. Now let's get your club on the map!</div>
              </>
            ) : (
              <>
                <div className="onb-done-title">You're all set!</div>
                <div className="onb-done-sub">Your application has been submitted for review. You'll have full access once approved — usually within 24 hours.<br/><br/>In the meantime, go ahead and set up your club profile.</div>
              </>
            )}
            <div className="onb-nav onb-nav-right" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '0.5px solid #f0f0f0' }}>
              <button className="onb-btn-next" onClick={handleNext}>Set up my club →</button>
            </div>
          </>)}

        </div>
      </div>
    </div>
  )
}
