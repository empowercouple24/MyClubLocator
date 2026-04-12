# My Club Locator — Session Summary
**Last updated:** April 12, 2026
**Live URL:** https://myclublocator.com
**Vercel project:** clubregistry (empowercouple24s-projects)
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**GitHub repo:** Private — MyClubLocator (public)
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1
**Brevo SMTP:** smtp-relay.brevo.com:587, login: empowercouple24@gmail.com
**Brevo API key:** stored in Vercel env only as VITE_BREVO_API_KEY (rotated April 2026)
**support@myclublocator.com** forwards to empowercouple24@gmail.com via Namecheap

---

## Tech Stack
React + Vite (dev only) | **esbuild** (production build) | Supabase (auth + DB + RLS) | Leaflet maps | OpenStreetMap Nominatim | US Census ACS API (2022 ACS5) | CDC PLACES | Vercel hosting + serverless functions | Brevo email

---

## Build System (IMPORTANT)
Production builds use **esbuild** via `node build.mjs`, NOT `vite build`.
- `npm run build` → `node build.mjs`
- Vite is only used for dev (`npm run dev`)
- `build.mjs` injects env vars into `dist/index.html` as `window.__env = {...}`
- All `import.meta.env.VITE_*` references in bundle point to `window.__env.*`

**Vercel build settings:**
- Build Command: `npm run build` (override ON)
- Install Command: `npm install --legacy-peer-deps` (override ON)
- Output Directory: `dist`

**Zip command (always use this exactly):**
```bash
cd /home/claude && zip -r my-club-locator.zip MyClubLocator-main/ \
  --exclude "MyClubLocator-main/node_modules/*" \
  --exclude "MyClubLocator-main/dist/*" \
  --exclude "MyClubLocator-main/package-lock.json" \
  --exclude "MyClubLocator-main/SESSION_SUMMARY.md"
```

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
api/
  geocode.js            ← Vercel serverless proxy for Census Geocoder (CORS fix)
build.mjs               ← esbuild production build script
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
- `/api/geocode` → Vercel serverless — proxies Census Geocoder

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
- `club_index INT DEFAULT 0` — **NEW as of April 12 session** — 0 = primary club, 1 = second club, etc. Migration: `ALTER TABLE locations ADD COLUMN IF NOT EXISTS club_index INT DEFAULT 0;`
- `herbalife_level TEXT` — e.g. `Presidents Team 30K 2 💎`
- `owner2_herbalife_level TEXT`, `owner3_herbalife_level TEXT`
- `owner_photo_url`, `owner2_photo_url`, `owner3_photo_url`
- `logo_url`, `photo_urls TEXT[]` — up to 10 photos
- `story_why`, `story_favorite_part`, `story_favorite_products`, `story_unique`, `story_before`, `story_goal`
- `survey_upline TEXT`
- `survey_hl_month TEXT`, `survey_hl_year TEXT`
- `survey_active_club BOOLEAN`
- `survey_club_month TEXT`, `survey_club_year TEXT`
- `survey_trainings TEXT` — comma-separated
- `survey_hear_how TEXT`, `survey_hear_detail TEXT`
- `survey_goal TEXT`
- `survey_completed_at TIMESTAMPTZ`

### `user_terms_acceptance`
- `user_id UUID`, `accepted_at`, `onboarding_done BOOLEAN`, `pending_survey TEXT`

### `app_settings` (single row, id=1)
- Welcome modal config, require_approval, 13 demographics toggles, col_widths

### `user_demo_preferences`
- `user_id UUID`, `preferences JSONB`
- Per-user toggles for market research factors

### `contact_submissions` + `contact_replies`
### `notifications`

### RLS Policies
- `locations`: SELECT all, UPDATE own row — **needs INSERT policy added for multi-club**
- `app_settings`: authenticated SELECT + UPDATE + INSERT
- `user_demo_preferences`: SELECT/INSERT/UPDATE own row only

---

## Migrations Run (through migration-014)
All migrations have been run against live DB. New migration needed for multi-club:
```sql
ALTER TABLE locations ADD COLUMN IF NOT EXISTS club_index INT DEFAULT 0;
```
Also update RLS to allow INSERT on locations for authenticated users owning the row.

---

## MapPage

**Markers:** red=own, periwinkle=others, gold=selected

**Hover tooltip:**
- Stays open on hover over entire tooltip container (fixed April 12)
- `ev.tooltip._container` used (not querySelector) to target correct tooltip per marker
- CSS bottom padding bridges gap between marker and tooltip
- "View in Directory →" navigates to `/app/directory?search=ClubName`
- Level pills: condensed format with space before 💎 — `PT 30K 2 💎`, `CC 7 💎`

**Toolbar (top center):**
- Search box: 308px wide
- Market Data button: 140px min-width, pulses when active, pointer cursor always (even in research mode)
- Scroll Zoom toggle button: on/off, persisted to localStorage
- +/− zoom buttons: shown only when scroll zoom is off, 38px square, large font

**Market Data Research Mode:**
- Crosshair cursor on map area only — toolbar buttons always show pointer cursor
- My Club auto-collapses, Club Details hides
- Click map → `/api/geocode` proxy → Census geocoder → demographics panel
- `app_settings` demo factor toggles loaded at mount
- Per-user factor prefs saved to `user_demo_preferences`

---

## ProfilePage — Current Card Structure

**CARD 1: Owners**
- Primary Owner: name, email, photo, Herbalife Level (uses `OwnerLevelPicker` component — collapses when confirmed)
- Owner 2 / Owner 3: same fields + `OwnerLevelPicker` — all collapsible
- All three owner cards collapse/expand independently

**🔴 NEXT: My Clubs wrapper card (replaces current CARD 2/3/4)**
- See full spec in NEXT FEATURE section of session starter
- Per-club fields: club name, address, phone, website, Instagram, hours, logo, photos, opened month/year, club email
- Per-person fields (stay outside): owners, Your Story, Member Survey

**CARD 5 (was CARD 6): Your Story**
- Collapsible (collapsed by default)
- Progress badge: "X of 6 filled" or "Complete"
- Uses same `survey-toggle-btn` / `survey-chevron` CSS as Member Survey

**CARD 6 (was CARD 7): Member Survey**
- Collapsible (collapsed by default)
- Progress badge: "X of 7 answered" or "Complete"

**`OwnerLevelPicker` component (defined in ProfilePage.jsx):**
- Self-contained: parses existing value on mount, manages own tier/k/dia/confirmed state
- Collapses to locked green checkmark row when confirmed
- "Change" button reopens picker
- Used for all 3 owners

---

## DirectoryPage
- Default: hidden, shows empty search prompt
- `?search=` URL param pre-fills search and shows results
- Cards collapsed by default on load
- Level pills: condensed with separate 💎 span

---

## AdminPage
**Settings Tab:** Welcome modal config, require approval, 13 demographics toggles
**Messages Tab:** Contact + Member Activity sub-tabs
**Members Tab:** Resizable columns, filters, approve/revoke/remove actions

---

## Herbalife Level — Quick Reference
Stored: `Presidents Team 30K 2 💎` | `Chairmans Club 7 💎` | `Founders Circle 100K 12 💎`
Condensed: `PT 30K 2 💎` | `CC 7 💎` | `FC 100K 12 💎` | `MP` | `MT` | `GT` etc.
Diamonds: PT=1–4 optional | CC=5–9 required | FC=10–15 required
K levels: PT=base,15K–150K | CC/FC=CC,FC,15K–150K

---

## Pending To-Do List
- [ ] #7 Map non-research mode: marker click opens club in panel, not Market Data
- [ ] #8 Add second club for empowercouple24@gmail.com (dual-club panel test)
- [ ] #9 Hours copy modal
- [ ] #10 Surface vetting survey in admin member detail modal
- [ ] #11 Welcome message for returning users on login
- [ ] #12 Apply `pending_survey` to `locations` on first profile save
- [ ] #13 Mobile overhaul (tabled)
- [ ] #14 Public Club Finder (big feature)
- [x] #15 My Clubs card + Add Club + multi-club DB architecture

---

## Known Notes
- `survey_active_club` can be boolean or string — comparisons handle both
- `lvlConfirmed` and all manual Owner 1 level picker state removed April 12 — `OwnerLevelPicker` handles everything
- `leaflet-shim.js` and `leaflet-esm.js` removed from repo April 12
- esbuild used instead of Vite for prod due to Rollup TDZ const-reordering bug
