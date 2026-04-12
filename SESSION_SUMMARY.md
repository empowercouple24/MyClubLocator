# My Club Locator — Session Summary
**Last updated:** April 12, 2026
**Live URL:** https://myclublocator.com
**Vercel project:** clubregistry (empowercouple24s-projects)
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**GitHub repo:** Private — MyClubLocator
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1
**Brevo SMTP:** smtp-relay.brevo.com:587, login: empowercouple24@gmail.com
**Brevo API key:** stored in Vercel env only as VITE_BREVO_API_KEY (rotated April 2026)
**support@myclublocator.com** forwards to empowercouple24@gmail.com via Namecheap

---

## Tech Stack
React + Vite (dev only) | **esbuild** (production build) | Supabase (auth + DB + RLS) | Leaflet maps | Mapbox (streets basemap + static tiles planned) | OpenStreetMap Nominatim | US Census ACS API (2022 ACS5) | CDC PLACES | Vercel hosting + serverless functions | Brevo email

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

**Required Vercel env vars:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BREVO_API_KEY`
- `VITE_CENSUS_API_KEY`
- `VITE_MAPBOX_TOKEN` — needed for Mapbox basemap

**Zip command (always use this exactly):**
```bash
cd /home/claude && zip -r my-club-locator.zip MyClubLocator-main/ \
  --exclude "MyClubLocator-main/node_modules/*" \
  --exclude "MyClubLocator-main/dist/*" \
  --exclude "MyClubLocator-main/package-lock.json"
```

---

## File Structure
```
src/
  pages/
    LandingPage.jsx
    LoginPage.jsx         — access control check + welcome message logic
    SignupPage.jsx        — access control check (signups_enabled)
    OnboardingPage.jsx
    MapPage.jsx           — main map, dashboard panel, demographics
    DirectoryPage.jsx
    ProfilePage.jsx       — multi-club architecture
    AdminPage.jsx         — 4 tabs: Settings, Access Controls, Messages, Members
    ResetPasswordPage.jsx
    ForgotPasswordPage.jsx
    PrivacyPage.jsx
  components/
    Layout.jsx            — nav with Admin tab (admin only) + amber dot indicator
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
  geocode.js              — Vercel serverless proxy for Census Geocoder (CORS fix)
build.mjs                 — esbuild production build script
```

---

## Routes
- `/` → LandingPage
- `/login` → LoginPage
- `/signup` → SignupPage
- `/onboarding` → OnboardingPage (shown once after signup)
- `/privacy` → PrivacyPage
- `/forgot-password` → ForgotPasswordPage
- `/reset-password` → ResetPasswordPage
- `/app/map` → MapPage (protected)
- `/app/directory` → DirectoryPage (protected, ?search= param pre-fills)
- `/app/profile` → ProfilePage (protected)
- `/app/admin` → AdminPage (admin only)
- `/api/geocode` → Vercel serverless — proxies Census Geocoder

---

## Auth & User Flow

### Brand new user
1. /signup — checks member_signups_enabled from app_settings on load; shows "Registration closed" if false
2. Email + password + terms accepted → account created, user_terms_acceptance row inserted, admin notification fired
3. Redirected immediately to /onboarding (no email verification gate currently)
4. Onboarding: 7-card survey (Welcome → Upline → HL tenure → Active club → Trainings → Hear how → Goal → Done)
5. Survey answers saved to pending_survey in user_terms_acceptance (no locations row exists yet)
6. onboarding_done = true saved to user_terms_acceptance
7. Redirected to /app/profile — pending_survey is loaded and pre-fills the Member Survey section

### Returning user — login flow
1. LoginPage fetches member_login_enabled from app_settings after auth
2. If member_login_enabled = false → immediately signs user out, shows "Access temporarily unavailable"
3. Admin (hardcoded ID) bypasses all access control checks always
4. Post-login routing:
   - onboarding_done = false → redirect to /onboarding
   - No locations row → show "no profile" welcome card with "Set up my club" CTA
   - Has profile, approved = false → show "pending approval" welcome card
   - Has profile, approved → show "welcome back" card, auto-navigate to map after 2.2s
5. All three welcome messages are customizable in Admin > Settings > Login Welcome Messages
6. {name} and {club} tokens in message text are replaced with real values at login time

### Three user types (current + planned)
| Type     | Role   | Notes                                      |
|----------|--------|--------------------------------------------|
| Club owner | member | Current — full app access after approval |
| Public account | public | Planned — #14                       |
| Admin    | admin  | Hardcoded ID, bypasses all toggles         |

---

## Database Tables

### locations
All club profile fields. Multiple rows per user allowed via club_index:
- club_index INT DEFAULT 0 — 0=primary, 1=second club, etc.
- user_id UUID — no longer has UNIQUE constraint (removed for multi-club)
- approved BOOLEAN DEFAULT false
- herbalife_level TEXT — e.g. Presidents Team 30K 2 diamond
- owner2_*, owner3_* — second and third owner fields
- owner_photo_url, owner2_photo_url, owner3_photo_url
- logo_url, photo_urls TEXT[] — up to 10 photos
- story_why, story_favorite_part, story_favorite_products, story_unique, story_before, story_goal
- survey_upline, survey_hl_month, survey_hl_year, survey_active_club BOOLEAN
- survey_club_month, survey_club_year, survey_trainings TEXT (comma-separated)
- survey_hear_how, survey_hear_detail, survey_goal, survey_completed_at TIMESTAMPTZ
- Social: instagram, tiktok, facebook, youtube, website
- Hours: hours_{day}_open, hours_{day}_close for each day of week

### user_terms_acceptance
- user_id UUID, accepted_at, onboarding_done BOOLEAN, pending_survey TEXT

### app_settings (single row, id=1)
All platform config. Current columns:
- welcome_video_enabled, welcome_video_url, welcome_video_placeholder
- welcome_title, welcome_message, welcome_disclaimer
- require_approval BOOLEAN
- member_signups_enabled BOOLEAN DEFAULT true
- member_login_enabled BOOLEAN DEFAULT true
- public_search_enabled BOOLEAN DEFAULT true
- public_accounts_enabled BOOLEAN DEFAULT true
- public_login_enabled BOOLEAN DEFAULT true
- login_msg_approved_enabled BOOLEAN, login_msg_approved TEXT
- login_msg_pending_enabled BOOLEAN, login_msg_pending TEXT
- login_msg_no_profile_enabled BOOLEAN, login_msg_no_profile TEXT
- 11 demo_* boolean columns for market data categories
- col_widths TEXT — JSON stringified admin member table column widths

### user_demo_preferences
- user_id UUID, preferences JSONB
- Stores: panelWidth ('normal'|'wide'), panelCollapsed (bool), clickBehavior ('zoom'|'pan'|'stay')

### contact_submissions, contact_replies, notifications

### Confirmed SQL migrations (all run against live DB)
```sql
-- Multi-club support
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_user_id_key;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS club_index INT DEFAULT 0;

-- Access controls
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS member_signups_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS member_login_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_search_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_accounts_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_login_enabled BOOLEAN DEFAULT true;

-- Login welcome messages
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS login_msg_approved_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_msg_approved TEXT DEFAULT 'Welcome back, {name}! {club} is live on the map.',
  ADD COLUMN IF NOT EXISTS login_msg_pending_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_msg_pending TEXT DEFAULT 'Welcome back, {name}! {club} is pending approval. You''ll appear on the map once approved.',
  ADD COLUMN IF NOT EXISTS login_msg_no_profile_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_msg_no_profile TEXT DEFAULT 'Welcome back! Your club profile isn''t set up yet. Finish setting it up to appear on the map.';
```

---

## MapPage — Key Details

### Markers
- Own club: red #D94F4F
- Other clubs: periwinkle #6B8DD6
- Selected: gold #F59E0B with two pulsing concentric rings (CSS keyframe, class marker-pulse-ring--1/2)

### Dashboard Panel
- Always-visible side panel, left or right position (bottom option removed)
- Width: normal or wide — toggled via single "Wide panel" pill
  - Right panel: pill is right-aligned
  - Left panel: pill is left-aligned
- Collapse/expand tab on map edge — arrow direction is position-aware
- overflow: visible on .club-panel so collapse tab is never clipped
- overflow-y: auto on .club-panel-inner (the scrollable content zone)
- Width + collapsed state + click behavior saved to user_demo_preferences

### Club click behavior (bottom-right controls bar)
- Zoom in — flies to club at zoom 14 (default for new users)
- Pan only — centers on club, keeps current zoom
- Stay put — opens in panel, map doesn't move
- Persisted to user_demo_preferences.preferences.clickBehavior

### Basemaps
- Mapbox Streets (default, leftmost) — requires VITE_MAPBOX_TOKEN
- OpenStreetMap (Carto Voyager)
- Aerial (Esri World Imagery)

### Bottom controls bar (position: absolute, bottom-right of map)
- Basemap toggle pills (left)
- "On click:" behavior picker (center) — label + 3 buttons
- Set Default View button + L/R panel position toggle (right)

### Hours display
- formatHoursDisplay() groups consecutive days with identical hours
- All rows forced single line: flex-wrap: nowrap, white-space: nowrap, flex-shrink: 0

### Phone/email
- Non-clickable in both dashboard panel and directory — plain span elements only

---

## ProfilePage — Card Structure

**Owners card**
- Primary owner: name, email, photo, Herbalife Level (OwnerLevelPicker component)
- Owner 2, Owner 3: same fields + collapsible, collapsed by default
- OwnerLevelPicker: self-contained, parses existing value on mount, collapses to locked confirmed row

**My Clubs (tabbed)**
- Each club is a tab showing club name + green dot when saved
- Per-club editor (ClubEditor): name, address, phone, email, website, social links, hours grid, opened date, logo, photos
- Add Club (with confirmation), Remove Club (with confirmation)
- Sticky save bar per club when dirty
- Social links: format-validated + live preview links

**Your Story (collapsible, closed by default)**
- 6 questions, progress badge "X of 6 filled" / "Complete"

**Member Survey (collapsible, closed by default)**
- 7 questions mirroring onboarding, pre-filled from pending_survey on first visit
- Progress badge "X of 7 answered" / "Complete"

---

## AdminPage — 4 Tabs

### Settings tab
- Welcome Modal — collapsible (closed by default): video toggle, title, message, video/placeholder URLs, disclaimer. Has Preview buttons.
- Member Approval — require approval toggle
- Login Welcome Messages — collapsible (closed by default): 3 message blocks, each with toggle + color-coded audience description + textarea. Tokens: {name}, {club}
- Demographics — Market Data — collapsible (closed by default): 11 toggles, live counter badge

### Access Controls tab
- Status card at top: green "All active" OR amber "X paused" with inline list of what's off
- 5 light switch cards in two groups: Club owners | Public users
- Each card: label, hint, status pill, rocker light switch
  - ON: dark green body, rocker up, green "Open/Active/Visible" pill, green card border
  - OFF: dark red body, rocker down, red "Paused/Hidden" pill, red card border + background tint
- Amber dot on tab header when any control is paused
- Sticky save bar appears when dirty

### Messages tab
- Sub-tabs: Contact (contact form submissions + replies) | Members (platform notifications)
- Unread count badge on tab header

### Members tab
- Resizable columns (widths saved to app_settings.col_widths)
- Filter by approval status
- Approve / Revoke / Remove actions

---

## Layout — Nav
- Topbar: brand name + user email + logout button
- Tabbar: Map | Directory | My Profile | Admin (admin only)
- Admin tab fetches app_settings on mount to check access control state
- Pulsing amber dot on Admin tab when any of the 5 access control keys is false
- Only visible to the hardcoded admin user ID

---

## Herbalife Level — Quick Reference
Stored: Presidents Team 30K 2 diamond | Chairmans Club 7 diamond | Founders Circle 100K 12 diamond
Condensed display: PT 30K 2D | CC 7D | FC 100K 12D | MP | MT | GT etc.
Diamonds: PT=1-4 optional | CC=5-9 required | FC=10-15 required
K levels: PT=base,15K-150K | CC/FC=CC,FC,15K-150K

---

## Pending To-Do List
- [ ] #14 Public Club Finder + public accounts (big feature — see notes below)
- [ ] #9 Hours copy modal (tabled — mobile overhaul)
- [ ] #13 Mobile overhaul (tabled for end)

### #14 Public Club Finder — Full Spec Notes
**Vision:** Two audiences on one landing page
- Find a club near me — public search, no account needed, gated by disclaimer
- I own a club / manage my listing — owner login/signup

**Public search experience:**
- Address or current location → sorted list of clubs by distance
- No full open interactive map — network is NOT visually exposed
- Per-club view: static Mapbox tile image (Static Images API, simple img tag, ~0.25mi radius)
  - Mapbox Static Images API URL pattern: /styles/v1/mapbox/streets-v12/static/pin+COLOR(lng,lat)/lng,lat,zoom/WxH@2x?access_token=TOKEN
  - Drop-in img tag, no JS map library needed
- Club info: name, hours, owners, photos, address — all plain text, no clickable contact
- Gated by acknowledgement/disclaimer modal before results shown

**Public accounts (optional, not required to search):**
- Save favorite clubs
- Submit notes about a club (visible to admin, optionally public)
- Controlled by public_accounts_enabled + public_login_enabled toggles (already in app_settings)
- public_search_enabled toggle controls whether finder is visible at all
- No messaging through the app — users copy contact info and reach out externally
- Google-esque model: search and find, club owners manage their own data

**Recommended build order:**
1. Polish owner onboarding flow first
2. Invite real club owners from network
3. Launch public finder once real data exists

---

## Session Conventions
- After every build: Claude prints updated to-do list in chat (completed + pending)
- Working directory: /home/claude/MyClubLocator-main/
- Build command: cd /home/claude/MyClubLocator-main && node build.mjs
- Always build and zip before presenting file to user

---

## Teams Feature (built April 12, 2026 — second session)

### DB tables (already migrated)
- `teams` — id, owner_user_id, name, created_at
- `team_members` — id, team_id, location_id, status ('pending'|'accepted'|'declined'), invited_at, responded_at
- `app_settings` new columns: `team_creation_enabled BOOLEAN DEFAULT true`, `team_creation_min_level TEXT DEFAULT 'Active World Team'`

### Level hierarchy (LEVEL_ORDER constant in ProfilePage.jsx)
Distributor → Success Builder → Supervisor → World Team → Active World Team → Get Team → Get Team 2500 → Millionaire Team → Millionaire Team 7500 → Presidents Team → Chairmans Club → Founders Circle

### ProfilePage — MyTeamSection component
- Checks `app_settings.team_creation_enabled` and `team_creation_min_level` 
- Shows pending invites banner with Accept/Decline buttons
- Shows "Teams I belong to" with Leave button
- Shows "Teams I manage" — collapsible cards with member list + invite search
- Invite search queries locations by club name, city, first name — sends in-app notification to invited user
- Create team form — only visible when level >= min level

### MapPage — Team filter
- `teamLocationIds` Set loaded on mount from teams owned by current user
- "My Team" button appears in bottom controls bar ONLY when user has accepted team members
- When active: team club markers show as purple `#7C3AED` with small ambient pulse (same as own-club pulse)
- Non-team clubs remain on map unchanged
- `teamFilter` state toggles the purple markers on/off

### AdminPage — Teams tab
- 5th tab: Settings | Access Controls | Messages | Members | Teams
- Lists all teams with owner name, created date, member count, pending count
- Dissolve button (with confirmation) — deletes entire team
- Remove individual member button
- Team Creation section in Settings tab — enable/disable toggle + min level dropdown

### Pending SQL for teams (run these if not already done)
```sql
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS team_creation_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_creation_min_level TEXT DEFAULT 'Active World Team';
```
