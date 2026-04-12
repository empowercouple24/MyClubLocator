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
React + Vite (dev only) | **esbuild** (production build) | Supabase (auth + DB + RLS) | Leaflet maps | OpenStreetMap Nominatim | US Census ACS API (2022 ACS5) | CDC PLACES | Vercel hosting + serverless functions | Brevo email

---

## Build System (IMPORTANT)
Production builds now use **esbuild** via `node build.mjs`, NOT `vite build`.
- `npm run build` → `node build.mjs`
- Vite is only used for dev (`npm run dev`)
- esbuild was necessary to avoid a Rollup TDZ const-reordering bug
- `build.mjs` injects env vars into `dist/index.html` as `window.__env = {...}`
- All `import.meta.env.VITE_*` references in bundle point to `window.__env.*`
- Bundle is identical across environments — env vars live in HTML, not JS

**Vercel build settings:**
- Build Command: `npm run build` (override ON)
- Install Command: `npm install --legacy-peer-deps` (override ON)
- Output Directory: `dist`

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
    leaflet-esm.js      ← esbuild leaflet ESM wrapper (unused but harmless)
    leaflet-shim.js     ← unused but harmless
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

### `user_demo_preferences`
- `user_id UUID`, `preferences JSONB`, `created_at`, `updated_at`
- Per-user toggles for which market research factors to show
- RLS: users can read/insert/update their own row

### `contact_submissions` + `contact_replies`
### `notifications` (type, title, body, user_id, is_read BOOLEAN default false)

### RLS Policies
- `app_settings`: authenticated SELECT + UPDATE + INSERT
- `contact_submissions`: anon+auth INSERT, auth SELECT+UPDATE
- `notifications`: auth INSERT+SELECT+UPDATE
- `locations`: SELECT all, UPDATE own row only
- `user_demo_preferences`: SELECT/INSERT/UPDATE own row only

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
| `migration-014-user-demo-preferences.sql` | user_demo_preferences table + RLS |

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

## MapPage

**Markers:** red=own, periwinkle=others, gold=selected

**Hover tooltip (min 293px, max 347px):**
- Logo/initials + club name + address under name (in header)
- Owner rows: 22px circular photo or initials + name + per-owner level pill
- Level pills show full condensed format: "PT 30K 2💎", "CC 7💎", "MT", "AWT" etc.
- Condensed hours (Mon–Fri grouped if same hours)
- "Club open since [month] [year]" in green
- "View in directory →" — navigates to `/app/directory?search=ClubName`
- Tooltip stays open 3 seconds after mouse leaves marker
- Hovering over tooltip itself keeps it open

**Club detail panel (left sidebar):**
- My Club card: collapsed by default, reduced size
- Club Details: hidden when Research Mode is active
- Hours shown in condensed grouped format

**Market Data Research Mode:**
- Activates crosshair + pulsing reticle
- My Club auto-collapses, Club Details hides
- Click map → proxies through `/api/geocode` (Vercel fn) → Census geocoder
- Loads: compact metric widgets (Population, Median Income, Age 18–49, Nearby Clubs), market score/grade, full demographics sections
- Admin-controlled factor toggles loaded from `app_settings` at MapPage mount
- Per-user factor prefs saved to `user_demo_preferences`
- Exit button restores normal state

**Census geocoder:** proxied via `api/geocode.js` (Vercel serverless) to fix CORS
**CDC PLACES:** uses `locationid` param (5-digit county FIPS) — dataset `swc5-untb`
**FIPS codes:** padded to 2-digit state + 3-digit county to ensure correct 5-digit format

---

## ProfilePage — All Cards

**CARD 1: Owners**
- All three owner cards (Primary, Owner 2, Owner 3) are collapsible (▲/▼ toggle)
- Primary owner: first/last name, email, owner photo (CropModal circle crop)
- Herbalife Level Picker (REQUIRED for owner 1 — see section below)
- Owner 2 / Owner 3: same name/email/photo + **full level picker** (same as owner 1)
- Owner 2/3 full picker: Tab Team → Future Pres → PT K+diamonds → CC/FC K+diamonds
- Confirm/lock/change flow same as owner 1

**CARD 2: Club Info**
- Club name, phone (auto-formatted to (xxx) xxx-xxxx), email, website, Instagram
- Address autocomplete (Nominatim) — city/state/zip auto-fill
- Opened month + year (optional)

**CARD 3: Hours**
- TimePicker: hours 1–12 in order, 15-min intervals, AM/PM
- Open/close per day, or mark closed

**CARD 4: Photos**
- Club logo: CropModal circle crop, uploads to Supabase Storage
- Gallery: up to 10 photos, drag to reorder (first = cover), fullscreen PhotoGallery

**CARD 5: Herbalife Level Picker (REQUIRED for owner 1)**
Three-tier flow:
Tier 1 — Tab Team: DS | SB | SP | WT | AWT
Tier 2 — Future Pres: GT | GP | MT | MP
Tier 3 — Pres Team: PT → K level → optional diamonds 1–4
Tier 4 — CC/FC: CC/FC → K level → required diamonds (5–9=CC, 10–15=FC)
Confirm flow → locked green state with "Change"

**CARD 6: Your Story** (all optional)
**CARD 7: Member Survey** (collapsible)

---

## DirectoryPage
- Default: hidden, shows empty search prompt
- `?search=` URL param pre-fills search and shows results
- Cards collapsed by default on load
- Level pills: condensed with separate 💎 span

---

## AdminPage

**Settings Tab:**
- Welcome modal config, require approval toggle, 13 demographics toggles
- Demo factor toggles affect what market research data is shown on the map

**Messages Tab:** Contact + Member Activity sub-tabs
**Members Tab:** Resizable columns, filters, approve/revoke/remove actions

---

## Herbalife Level — Quick Reference

Stored: `Presidents Team 30K 2 💎` | `Chairmans Club 7 💎` | `Founders Circle 100K 12 💎`
Condensed (map bubbles): `PT 30K 2💎` | `CC 7💎` | `FC 100K 12💎` | `MP` | `MT` | `GT` etc.

Diamonds: PT=1–4 optional | CC=5–9 required | FC=10–15 required
K levels: PT=base,15K–150K | CC/FC=CC,FC,15K–150K

---

## Pending To-Do List

- [ ] Hours copy modal (copy one day's hours to multiple days)
- [ ] Surface vetting survey answers in admin member detail modal
- [ ] Welcome message for returning users on login
- [ ] Apply `pending_survey` data to `locations` on first profile save
- [ ] Mobile overhaul (tabled for end)
- [ ] PUBLIC CLUB FINDER: homepage redesign, customer address search, nearest clubs list, distance/radius, public user login to save favorites, member login moves to nav

---

## Known Issues / Notes
- `survey_active_club` can be boolean or string — all comparisons handle both
- `pending_survey` JSON not auto-applied to `locations` on first profile save (gap)
- `lvlConfirmed` is local state — doesn't persist across page reload (intentional)
- `leaflet-shim.js` and `leaflet-esm.js` in src/lib are unused artifacts — harmless
- esbuild TDZ bug was the original blank screen issue — root cause was `const condenseLvl` declared after its first use inside a useEffect in MapPage (fixed)
