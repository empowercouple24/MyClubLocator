# My Club Locator — Session Summary
**Last updated:** April 12, 2026
**Live URL:** https://myclublocator.com
**Vercel project:** clubregistry (empowercouple24s-projects)
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**GitHub repo:** Private — MyClubLocator
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1
**Brevo SMTP:** smtp-relay.brevo.com:587, login: empowercouple24@gmail.com
**Brevo API key:** stored in Vercel env only as VITE_BREVO_API_KEY
**support@myclublocator.com** forwards to empowercouple24@gmail.com via Namecheap

---

## Tech Stack
React + Vite (dev only) | **esbuild** (production build) | Supabase (auth + DB + RLS) | Leaflet maps | Mapbox (streets basemap + Static Images API for public finder) | OpenStreetMap Nominatim | US Census ACS API | CDC PLACES | Vercel hosting + serverless functions | Brevo email

---

## Build System
Production builds use **esbuild** via `node build.mjs`, NOT `vite build`.
- `npm run build` → `node build.mjs`
- Vite is only used for dev (`npm run dev`)
- `build.mjs` injects env vars into `dist/index.html` as `window.__env = {...}`

**Vercel build settings:**
- Build Command: `npm run build` (override ON)
- Install Command: `npm install --legacy-peer-deps` (override ON)
- Output Directory: `dist`

**Required Vercel env vars:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BREVO_API_KEY`, `VITE_CENSUS_API_KEY`, `VITE_MAPBOX_TOKEN`

**Zip command:**
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
    LandingPage.jsx        — 3 cards: Find a club / Returning member / New member
    LoginPage.jsx          — access control check + welcome message logic
    SignupPage.jsx         — access control check (signups_enabled)
    OnboardingPage.jsx
    MapPage.jsx            — main map, dashboard panel, demographics, team filter
    DirectoryPage.jsx
    ProfilePage.jsx        — multi-club + MyTeamSection component
    AdminPage.jsx          — 5 tabs: Settings/Access Controls/Messages/Members/Teams
    PublicFinderPage.jsx   — public club search, auth modal, favorites, notes
    ResetPasswordPage.jsx, ForgotPasswordPage.jsx, PrivacyPage.jsx
  components/
    Layout.jsx             — nav with Admin tab (admin only) + amber dot indicator
    UpdateBanner.jsx, WelcomeModal.jsx, TimePicker.jsx
    AddressAutocomplete.jsx, MapSearchAutocomplete.jsx
    DemographicsPanel.jsx, CropModal.jsx, PhotoGallery.jsx
  lib/
    supabase.js, AuthContext.jsx, demographics.js
  App.jsx, index.css, main.jsx
api/
  geocode.js              — Vercel serverless proxy for Census Geocoder
build.mjs
```

---

## Routes
- `/` → LandingPage
- `/find` → PublicFinderPage (no auth required)
- `/login`, `/signup`, `/onboarding`, `/privacy`, `/forgot-password`, `/reset-password`
- `/app/map`, `/app/directory`, `/app/profile`, `/app/admin` (all protected)
- `/api/geocode` → Vercel serverless

---

## Database Tables

### `locations`
- `club_index INT DEFAULT 0` — 0=primary club, multi-club support
- `user_id UUID` — no UNIQUE constraint (removed for multi-club)
- `approved BOOLEAN DEFAULT false`
- All profile fields: names, emails, phones, addresses, hours, social links, photos, story fields, survey fields

### `user_terms_acceptance`
- `user_id, accepted_at, onboarding_done BOOLEAN, pending_survey TEXT`

### `app_settings` (single row, id=1) — ALL CURRENT COLUMNS
```
welcome_video_enabled, welcome_video_url, welcome_video_placeholder
welcome_title, welcome_message, welcome_disclaimer
require_approval
member_signups_enabled, member_login_enabled
public_search_enabled, public_accounts_enabled, public_login_enabled
login_msg_approved_enabled, login_msg_approved
login_msg_pending_enabled, login_msg_pending
login_msg_no_profile_enabled, login_msg_no_profile
public_finder_welcome, public_finder_disclaimer_enabled, public_finder_disclaimer
team_creation_enabled, team_creation_min_level
marker_color_own, marker_color_other, marker_color_selected, marker_color_team
demo_population, demo_income, demo_age_fit, demo_median_age, demo_poverty
demo_competition, demo_health, demo_spending, demo_growth, demo_commute
demo_competitors, demo_unemployment, demo_households
col_widths (JSON stringified admin member table column widths)
```

### `user_demo_preferences`
- `user_id UUID, preferences JSONB`
- Stores: `panelWidth`, `panelCollapsed`, `clickBehavior`

### `public_accounts`
- `id UUID, auth_user_id UUID, email TEXT, display_name TEXT, created_at`

### `public_favorites`
- `id UUID, public_account_id UUID, location_id UUID, created_at`
- UNIQUE(public_account_id, location_id)

### `club_notes`
- `id UUID, public_account_id UUID, location_id UUID, note TEXT, is_read BOOLEAN, forwarded BOOLEAN, created_at`

### `teams`
- `id UUID, owner_user_id UUID, name TEXT, created_at`

### `team_members`
- `id UUID, team_id UUID, location_id UUID, status TEXT ('pending'|'accepted'|'declined'), invited_at, responded_at`
- UNIQUE(team_id, location_id)

### `contact_submissions`, `contact_replies`, `notifications`

### RLS policies needed
```sql
-- Public finder (already done)
CREATE POLICY "Public can view approved locations"
ON locations FOR SELECT TO anon USING (approved = true);

-- Public accounts
ALTER TABLE public_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their account" ON public_accounts FOR ALL TO authenticated
  USING (auth_user_id = auth.uid());
ALTER TABLE public_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their favorites" ON public_favorites FOR ALL TO authenticated
  USING (public_account_id IN (SELECT id FROM public_accounts WHERE auth_user_id = auth.uid()));
ALTER TABLE club_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public users insert own notes" ON club_notes FOR INSERT TO authenticated
  WITH CHECK (public_account_id IN (SELECT id FROM public_accounts WHERE auth_user_id = auth.uid()));
CREATE POLICY "Admin reads all notes" ON club_notes FOR SELECT TO authenticated USING (true);
```

---

## Auth & User Flows

### Brand new member
1. `/signup` checks `member_signups_enabled` → shows "closed" if false
2. Email + password + terms → creates account → inserts `user_terms_acceptance` row → admin notification
3. Goes to `/onboarding` — 7-card survey, all skippable except active club question
4. Survey saved to `pending_survey` in `user_terms_acceptance`
5. Redirected to `/app/profile` — `pending_survey` pre-fills Member Survey section

### Returning member login
1. LoginPage fetches `member_login_enabled` after auth — signs out + error if false
2. Admin (hardcoded ID) bypasses all checks
3. Post-login routing: no onboarding → `/onboarding` | no profile → no-profile welcome card | pending → pending card | approved → welcome card + auto-navigate to map after 2.2s
4. All three welcome messages customizable in Admin → Settings → Login Welcome Messages
5. `{name}` and `{club}` tokens replaced at login time

### Three user types
| Type | Notes |
|------|-------|
| Club owner (member) | Full app access after approval |
| Public account | `/find` page only — save favorites, leave notes |
| Admin | Hardcoded ID, bypasses all toggles |

---

## MapPage — Key Architecture

### Marker system
- `makeCircleIcon(type, colors)` — accepts dynamic color overrides
- `getIcons(colors)` — cached by JSON signature of colors object, busts cache on color change
- Four types: `own` (red, small ambient pulse), `other` (periwinkle), `selected` (gold, large expanding rings), `team` (purple, small ambient pulse)
- Colors loaded from `app_settings` on mount, passed through `ClubMarkers` → `getIcons`

### Dashboard panel
- Normal (3 slots) / Wide (5 slots) toggle — pill button, right/left aligned by panel position
- Collapse tab on map edge — arrow direction is position-aware
- `overflow: visible` on `.club-panel`, `overflow-y: auto` on `.club-panel-inner`
- Width + collapsed + click behavior saved to `user_demo_preferences`

### Club click behavior
- Zoom in (default) / Pan only / Stay put — persisted to `user_demo_preferences`

### Photo strip in dashboard
- 3 slots normal, 5 slots wide — equal-width tiles, 88px fixed height
- Empty slots: light gray dashed border + faint camera icon
- Prev/Next buttons below strip when overflow, with green dot indicators
- Clicking a photo opens `PhotoGallery` lightbox

### Team filter
- "My Team" button in bottom controls — only visible when user has accepted team members
- Loads team location IDs on mount from `teams` owned by current user
- Active: team markers turn to team color (default purple) with ambient pulse
- Non-team clubs unchanged

### Bottom controls bar
- Basemap toggle | My Team filter | "On click:" behavior picker | Set Default View + panel position

---

## ProfilePage — Key Architecture

### Card structure
1. Owners (primary + 2 optional, collapsible)
2. My Clubs (tabbed, multi-club, per-club `ClubEditor`)
3. Your Story (collapsible, 6 questions)
4. Member Survey (collapsible, 7 questions, pre-filled from onboarding)
5. My Team (`MyTeamSection` component)

### MyTeamSection component
- Self-contained, queries `teams` + `team_members` + `app_settings`
- Level eligibility: `LEVEL_ORDER` array + `levelRank()` function
- Pending invites banner (amber) with Accept/Decline
- Teams I belong to list with Leave
- Teams I manage — collapsible cards with member list + invite search
- Invite sends in-app notification to invited club owner
- Create team form — gated by `team_creation_enabled` + `team_creation_min_level`

### Photo strip (ProfilePage)
- `photos-strip` CSS: `grid-template-columns: repeat(10, 1fr)`, aspect-ratio: 1
- 10 slots always rendered: filled = photo tile, slot N = add (+), rest = camera icon placeholders
- Drag to reorder, remove button, cover badge on slot 0

---

## AdminPage — 5 Tabs

### Settings tab (all collapsible cards)
- Welcome Modal (closed by default)
- Member Approval
- Login Welcome Messages (closed by default) — 3 customizable messages with `{name}`/`{club}` tokens
- Public Finder Messages (closed by default) — heading text + disclaimer
- **Map Marker Colors** (closed by default) — 4 color pickers with live faux-map preview
- Team Creation — enable toggle + min level dropdown
- Demographics — Market Data (closed by default, shows "X of 11 enabled")

### Access Controls tab
- 5 light switch cards: member signups, member login, public search, public account signups, public account login
- Status card at top: green "All active" OR amber "X paused" with list
- Amber dot on tab + on Admin nav link when anything is paused

### Messages tab
- Sub-tabs: Contact messages | Member activity | **Club Notes**
- Club Notes: shows notes from public users, "Forward to owner →" sends Brevo email + in-app notification, "Forwarded ✓" badge after

### Members tab
- Resizable columns (saved to `app_settings.col_widths`)
- Filter by approval status, approve/revoke/remove actions

### Teams tab
- Lists all teams: name, owner, dates, member count, pending count
- Dissolve team (confirmation) + remove individual members

---

## Public Finder (/find)

### Flow
1. Checks `public_search_enabled` — shows "not available" if false
2. If `public_finder_disclaimer_enabled` — shows disclaimer screen, must tap "I understand"
3. Search by address (Nominatim geocoding) or geolocation
4. Results: top 25 clubs sorted by distance, only approved, club_index=0
5. Each result: collapsible card — name, city, distance badge, open/closed + today's hours
6. Expanded: Mapbox static tile image, full address, phone, email (plain text), owners, full hours, photos

### Auth (public accounts)
- Top bar: "Sign in / Create account" when logged out, "Hi [name] · Sign out" when logged in
- Auth modal: sign in / create account tabs — checks `public_accounts_enabled` + `public_login_enabled`
- On signup: creates `public_accounts` row

### Favorites
- Heart icon on every club card
- Logged-out: heart click opens auth modal
- Logged-in: toggles `public_favorites` row instantly
- "My Saved Clubs" collapsible panel above results when favorites exist

### Notes
- "Leave a note" button in expanded card (logged-in only)
- Submits to `club_notes` table + fires in-app notification
- Admin sees notes in Messages → Club Notes, can forward to owner via Brevo email

---

## Level Hierarchy (ProfilePage.jsx LEVEL_ORDER constant)
```
Distributor → Success Builder → Supervisor → World Team → Active World Team
→ Get Team → Get Team 2500 → Millionaire Team → Millionaire Team 7500
→ Presidents Team → Chairmans Club → Founders Circle
```

---

## Pending SQL Migrations (confirm all are run)
```sql
-- Multi-club
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

-- Public finder
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS public_finder_welcome TEXT DEFAULT 'Find a nutrition club near you',
  ADD COLUMN IF NOT EXISTS public_finder_disclaimer_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_finder_disclaimer TEXT DEFAULT 'This directory is provided for informational purposes only...';

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(team_id, location_id)
);
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS team_creation_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_creation_min_level TEXT DEFAULT 'Active World Team';

-- Public accounts
CREATE TABLE IF NOT EXISTS public_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, display_name TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_account_id UUID REFERENCES public_accounts(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(public_account_id, location_id)
);
CREATE TABLE IF NOT EXISTS club_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_account_id UUID REFERENCES public_accounts(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  note TEXT NOT NULL, is_read BOOLEAN DEFAULT false,
  forwarded BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);

-- Landing page appearance
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS landing_eyebrow_color TEXT DEFAULT '#F1EFE8',
  ADD COLUMN IF NOT EXISTS landing_hero_panel_color TEXT DEFAULT '#1A3C2E';
  ADD COLUMN IF NOT EXISTS marker_color_own      TEXT DEFAULT '#D94F4F',
  ADD COLUMN IF NOT EXISTS marker_color_other    TEXT DEFAULT '#6B8DD6',
  ADD COLUMN IF NOT EXISTS marker_color_selected TEXT DEFAULT '#F59E0B',
  ADD COLUMN IF NOT EXISTS marker_color_team     TEXT DEFAULT '#7C3AED';
```

---

## Pending To-Do List
- [ ] #9 Hours copy modal (tabled — mobile overhaul)
- [ ] #13 Mobile overhaul (tabled for end)

---

## Session Conventions
- After every build: Claude prints updated to-do list
- Working directory: `/home/claude/MyClubLocator-main/`
- Build: `cd /home/claude/MyClubLocator-main && node build.mjs`
- Always build and zip before presenting file to user

---

## Landing Page Redesign (completed Apr 12 2026)
- **LandingPage.jsx** rebuilt — Option B hero card + eyebrow strip B
- Hero: full-width two-column grid (content left / decorative panel right), eyebrow strip spans full bottom edge
- Eyebrow strip: left col = "Club owners / Add & manage →", two cells = Log in + Add my club
- Live club count pulled from Supabase `locations` on mount
- Both colors (`landing_eyebrow_color`, `landing_hero_panel_color`) loaded from `app_settings` on mount
- Admin → Settings → **Landing Page Appearance** card (collapsible, sits above Marker Colors):
  - 7 eyebrow swatches (default: Cool grey `#F1EFE8`)
  - 8 hero panel swatches (default: Forest green `#1A3C2E`)
  - Live mini-preview updates instantly
- **SQL to run:** `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS landing_eyebrow_color TEXT DEFAULT '#F1EFE8', ADD COLUMN IF NOT EXISTS landing_hero_panel_color TEXT DEFAULT '#1A3C2E';`

---

## App Theme System (completed Apr 12 2026)
CSS custom properties drive all card and page colors. Injected on `document.documentElement` at app boot (App.jsx) and live-updated as admin changes pickers.

Variables: `--theme-page-bg`, `--theme-card-header-bg`, `--theme-card-header-text`, `--theme-card-body`

Defaults: `#E8E3D8` / `#1A3C2E` / `#ffffff` / `#ffffff`

Landing page background intentionally NOT themed — stays `#f4f7f5` always.

Admin → Settings → **App Theme** card (collapsible, above Landing Page Appearance):
- 8 page background swatches (creams/sands/greys)
- 8 card header background swatches (same as eyebrow options)
- 4 card header text options (shown as "Aa" on actual header bg color)
- 4 card body swatches (whites/creams)
- Live mini-preview updates instantly

**SQL to run:**
```sql
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS theme_page_bg TEXT DEFAULT '#E8E3D8',
  ADD COLUMN IF NOT EXISTS theme_card_header_bg TEXT DEFAULT '#1A3C2E',
  ADD COLUMN IF NOT EXISTS theme_card_header_text TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS theme_card_body TEXT DEFAULT '#ffffff';
```
