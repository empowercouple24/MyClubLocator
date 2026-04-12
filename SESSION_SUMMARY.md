# My Club Locator — Session Summary
**Last updated:** April 12, 2026
**Live URL:** https://myclublocator.com
**Vercel project:** clubregistry (empowercouple24s-projects)
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**GitHub repo:** Private — clubregistry
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1
**Brevo SMTP:** smtp-relay.brevo.com:587, login: empowercouple24@gmail.com
**Brevo API key:** stored in Vercel environment variables only as VITE_BREVO_API_KEY (rotated April 2026)
**support@myclublocator.com** forwards to empowercouple24@gmail.com via Namecheap

---

## Tech Stack
React + Vite | Supabase (auth + DB + RLS) | Leaflet maps | OpenStreetMap Nominatim | US Census ACS API (2022 ACS5) | CDC PLACES | Vercel hosting | Brevo email

---

## File Structure
```
src/
  pages/
    LandingPage.jsx
    LoginPage.jsx
    SignupPage.jsx
    OnboardingPage.jsx
    MapPage.jsx
    DirectoryPage.jsx
    ProfilePage.jsx
    AdminPage.jsx
    ResetPasswordPage.jsx
    ForgotPasswordPage.jsx
    PrivacyPage.jsx
  components/
    Layout.jsx
    UpdateBanner.jsx
    WelcomeModal.jsx
    TimePicker.jsx
    AddressAutocomplete.jsx
    MapSearchAutocomplete.jsx
    DemographicsPanel.jsx
    CropModal.jsx
    PhotoGallery.jsx
  lib/
    supabase.js
    AuthContext.jsx
    demographics.js
  App.jsx
  index.css
  main.jsx
```

---

## Routes
- `/` → LandingPage
- `/login` → LoginPage
- `/signup` → SignupPage
- `/onboarding` → OnboardingPage (shown once after email confirmation)
- `/privacy` → PrivacyPage
- `/app/map` → MapPage (protected)
- `/app/directory` → DirectoryPage (protected, ?search= param pre-fills)
- `/app/profile` → ProfilePage (protected)
- `/app/admin` → AdminPage (protected)

---

## Full Signup & Auth Flow
1. `/signup` — email + password + terms → submit
2. Branded confirmation email → user clicks link
3. Redirected to `/onboarding` — card-by-card survey (all skippable, runs once)
4. After survey → `/app/profile` — set up club profile
5. Profile saved → pending approval → admin approves → visible on map/directory
- `onboarding_done = true` saved after completing or skipping all cards
- If `onboarding_done` already true, `/onboarding` redirects immediately to `/app/profile`

---

## Database Tables

### `locations`
All club profile fields plus:
- `herbalife_level TEXT` — e.g. `Presidents Team 30K 2 💎`
- `owner2_herbalife_level TEXT`, `owner3_herbalife_level TEXT`
- `owner_photo_url`, `owner2_photo_url`, `owner3_photo_url`
- `logo_url`, `photo_urls TEXT[]` — up to 10 photos
- `story_why`, `story_favorite_part`, `story_favorite_products`, `story_unique`, `story_before`, `story_goal`
- `survey_upline TEXT`
- `survey_hl_month TEXT`, `survey_hl_year TEXT`
- `survey_active_club BOOLEAN`
- `survey_club_month TEXT`, `survey_club_year TEXT`
- `survey_trainings TEXT` — comma-separated: local,zoom,sts,regional,extrav,all
- `survey_hear_how TEXT`, `survey_hear_detail TEXT`
- `survey_goal TEXT`
- `survey_completed_at TIMESTAMPTZ`

### `user_terms_acceptance`
- `user_id UUID`, `accepted_at`, `onboarding_done BOOLEAN`, `pending_survey TEXT`

### `app_settings` (single row, id=1)
- `welcome_video_enabled BOOLEAN`, `welcome_video_url TEXT`, `welcome_video_placeholder TEXT`
- `welcome_title TEXT`, `welcome_message TEXT`, `welcome_disclaimer TEXT`
- `require_approval BOOLEAN`
- `demo_population`, `demo_income`, `demo_age_fit`, `demo_poverty`, `demo_competition`
- `demo_unemployment`, `demo_households`, `demo_median_age`, `demo_health`
- `demo_spending`, `demo_growth`, `demo_commute`, `demo_competitors` — all BOOLEAN
- `col_widths TEXT` — JSON array of admin Members table column widths

### `contact_submissions` + `contact_replies`
### `notifications` (type, title, body, user_id, is_read BOOLEAN default false)

### RLS Policies
- `app_settings`: authenticated SELECT + UPDATE + INSERT
- `contact_submissions`: anon+auth INSERT, auth SELECT+UPDATE
- `notifications`: auth INSERT+SELECT+UPDATE
- `locations`: SELECT all, UPDATE own row only

---

## Migrations (run in order in Supabase SQL Editor)
| File | Description |
|------|-------------|
| `migration-006-owner-photos.sql` | owner_photo_url fields |
| `migration-007-welcome-disclaimer.sql` | welcome_disclaimer on app_settings |
| `migration-008-terms-accepted.sql` | user_terms_acceptance table |
| `migration-009-col-widths.sql` | app_settings.col_widths |
| `migration-010-vetting-survey.sql` | All survey_* columns + onboarding_done + pending_survey |
| `migration-011-settings-rls-fix.sql` | INSERT policy + missing columns + seed row for app_settings |
| `migration-012-messages-rls-fix.sql` | RLS on contact_submissions + notifications + backfill is_read NULLs |
| `migration-013-owner-levels.sql` | owner2_herbalife_level + owner3_herbalife_level |

**Also needed if not already run:**
```sql
ALTER TABLE locations ADD COLUMN IF NOT EXISTS herbalife_level TEXT DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS story_before TEXT DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS story_goal TEXT DEFAULT NULL;
```

---

## Environment Variables (Vercel Dashboard Only — never in code)
```
VITE_SUPABASE_URL=https://ulezfnzqwebkupgxqprs.supabase.co
VITE_SUPABASE_ANON_KEY=[anon key]
VITE_BREVO_API_KEY=[rotated April 2026]
VITE_CENSUS_API_KEY=[census key]
```

---

## OnboardingPage (`/onboarding`)
Card-by-card survey, all skippable, runs once per user.

Cards:
1. Welcome intro
2. Who is your upline/sponsor? (text)
3. How long Herbalife member? (month optional + year, back to 1980)
4. Actively operating a club? (Yes/No) — if Yes, club tenure fields appear inline same card
5. Trainings attended (multi-select): local events & trainings (quickstarts, workshops) | Team Zoom calls | STS (Success Training Seminar) | regional quarterly (LDW/FSL, BAE, Amplify/Elevate) | Extravaganza | All of the above
6. How did you hear? (radio + conditional text): upline told me | club owner | on Zoom | at an event | Other (text field)
7. Primary goal for joining (textarea)
8. Done — pending review + "Set up my club →"

Answers saved to `locations.survey_*` if profile exists, else to `user_terms_acceptance.pending_survey` as JSON.

---

## ProfilePage — All Cards

**CARD 1: Owners**
- Primary owner: first/last name, email, owner photo (CropModal circle crop)
- Herbalife Level Picker (REQUIRED — see section below)
- Owner 2 / Owner 3 (optional): same name/email/photo + compact level picker
- Compact level picker: 12-button row DS|SB|SP|WT|AWT|GT|GP|MT|MP|PT|CC|FC — optional, clearable, saves to owner2/3_herbalife_level

**CARD 2: Club Info**
- Club name, phone (auto-formatted to (xxx) xxx-xxxx), email, website, Instagram
- Address autocomplete (Nominatim) — city/state/zip auto-fill
- Opened month + year (optional)

**CARD 3: Hours**
- TimePicker: hours 1–12 in order, 15-min intervals, AM/PM
- Open/close per day, or mark closed
- Hours copy (TO-DO: modal not yet built)

**CARD 4: Photos**
- Club logo: CropModal circle crop, uploads to Supabase Storage
- Gallery: up to 10 photos, drag to reorder (first = cover), fullscreen PhotoGallery
- Gallery modal: backdrop rgba(0,0,0,0.55), max-width 900px, max-height 80vh, thumbnails 90px

**CARD 5: Herbalife Level Picker (REQUIRED)**
Three-tier flow:

Tier 1 — Tab Team: DS (gray) | SB (gray) | SP (green) | WT (gray) | AWT (gray)
Tier 2 — Future Pres: GT (red) | GP (amber) | MT (teal) | MP (light blue)
Tier 3 — Pres Team: PT → K level (PT/15K–150K) → optional diamonds 1–4
Tier 4 — CC/FC: CC/FC → K level → required diamonds (5–9=CC, 10–15=FC)

Confirm flow: selections complete → "Confirm level" button → click → dimmed overlay → locked green state with "Change". Save disabled until confirmed. On load: restores from saved `herbalife_level` and starts locked.

**CARD 6: Your Story** (all optional, in this exact order)
1. Why did you decide to open your club?
2. What is your favorite part of club ownership?
3. What did you do for work before owning your club?
4. What is your next big goal in Herbalife?
5. What are your favorite products?
6. What is something unique and interesting about yourself?

**CARD 7: Member Survey** (collapsible, collapsed by default)
Header: amber "X of 7 answered" badge or green "Complete" badge. Click to expand/collapse.
Same 7 questions as onboarding. Pre-filled from onboarding answers. Badge disappears only when ALL 7 fields have content.

**Unsaved Changes Save Bar**
- `savedFormRef` snapshots on load + after save
- Bar hidden when clean (existing profile), always visible for new profiles
- When dirty: amber top border + warm yellow bg + "⚠ Unsaved changes" left alert
- After save: hides until next edit

---

## MapPage

**Markers:** red=own, periwinkle=others, gold=selected

**Hover tooltip (min 293px, max 347px):**
- Logo/initials + club name + address under name (in header)
- Owner rows: 22px circular photo or initials + name + per-owner level pill
- Condensed hours (Mon–Fri grouped if same hours)
- "Club open since [month] [year]" in green
- "View in directory →" — navigates to `/app/directory?search=ClubName`

**Club detail panel (left sidebar):**
- My Club card: collapsed by default, reduced size
- Club Details: hidden when Research Mode is active
- Hours shown in condensed grouped format

**Market Data Research Mode:**
- Activates crosshair + pulsing reticle
- My Club auto-collapses, Club Details hides
- Click map → loads: compact metric widgets (Population, Median Income, Age 18–49, Nearby Clubs), market score/grade, full demographics sections
- Exit button restores normal state

**Census geocoder fixes:**
- Tries `Census2020_Current` vintage first, fallback `Current_Current`
- ZIP layer: `'2020 ZIP Code Tabulation Areas'` with fallbacks
- 12s timeout, 2 retries

**CDC PLACES fix:** uses `countyfips` param (not stateabbr/locationid)

---

## DirectoryPage
- Default: hidden, shows empty search prompt
- `?search=` URL param pre-fills search and shows results
- Cards collapsed by default on load
- Collapsed: logo + club name + address
- Expanded: owner photos/initials + name + level pill, condensed hours, contact, social
- Hours condensed: Mon–Fri 7:00 AM – 3:00 PM (consecutive same-hours days grouped)

---

## AdminPage

**Settings Tab:**
- Welcome modal config, require approval toggle, 13 demographics toggles
- Dirty detection + sticky amber save bar (same as ProfilePage)
- Explicit field list in save payload (not spread) to avoid silent failures

**Messages Tab:**
- Contact sub-tab + Member Activity sub-tab
- Mark all read uses `.or('is_read.eq.false,is_read.is.null')` to handle NULL values

**Members Tab:**
- Resizable columns (drag handle), widths saved to `app_settings.col_widths`
- 11 columns, filters, approve/revoke/remove actions
- Member detail modal (survey display is to-do)

---

## Herbalife Level — Quick Reference

Stored: `Presidents Team 30K 2 💎` | `Chairmans Club 7 💎` | `Founders Circle 100K 12 💎`

Condensed: PT | CC | FC | MP | MT | GP | GT | AWT | WT | SP | SB | DS

Diamonds: PT=1–4 optional | CC=5–9 required | FC=10–15 required

K levels: PT=base, 15K, 20K, 30K, 40K, 50K, 60K, 70K, 80K, 90K, 100K–150K

---

## Pending To-Do List

- [ ] Hours copy modal (copy one day's hours to multiple days)
- [ ] Surface vetting survey answers in admin member detail modal
- [ ] Welcome message for returning users on login
- [ ] Market data tool production tuning (Census API may need further testing)
- [ ] Apply `pending_survey` data to `locations` on first profile save
- [ ] Mobile overhaul (tabled for end)
- [ ] PUBLIC CLUB FINDER: homepage redesign, customer address search, nearest clubs list, distance/radius, public user login to save favorites, member login moves to nav

---

## Known Issues
- `survey_active_club` can be boolean or string — all comparisons handle both
- `pending_survey` JSON not auto-applied to `locations` on first profile save (gap)
- `lvlConfirmed` is local state — doesn't persist across page reload (intentional)
- Mark all read previously missed NULL rows — fixed with `.or()` filter
- Census geocoder vintage was deprecated — fixed
- CDC PLACES wrong params — fixed
- app_settings upsert was failing silently — fixed in migration-011
