# My Club Locator — Session Summary
**Last updated:** April 12, 2026  
**Live URL:** https://myclublocator.com  
**Vercel project:** clubregistry (empowercouple24s-projects)  
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co  
**GitHub repo:** Private — clubregistry  
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1  
**Brevo SMTP:** smtp-relay.brevo.com:587, login: empowercouple24@gmail.com  
**Brevo API key:** stored in Vercel environment variables as VITE_BREVO_API_KEY  
**support@myclublocator.com** forwards to empowercouple24@gmail.com via Namecheap

---

## Tech Stack
React + Vite | Supabase (auth + DB + RLS) | Leaflet maps | OpenStreetMap Nominatim | US Census ACS API | CDC PLACES | Vercel hosting | Brevo email

---

## File Structure
```
src/
  pages/
    LandingPage.jsx
    LoginPage.jsx
    SignupPage.jsx
    OnboardingPage.jsx        ← NEW this session
    MapPage.jsx
    DirectoryPage.jsx         ← Major rewrite this session
    ProfilePage.jsx           ← Major updates this session
    AdminPage.jsx             ← Major updates this session
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
- `/onboarding` → OnboardingPage ← NEW
- `/privacy` → PrivacyPage
- `/app/map` → MapPage (protected)
- `/app/directory` → DirectoryPage (protected)
- `/app/profile` → ProfilePage (protected)
- `/app/admin` → AdminPage (protected)

---

## Database Tables

### `locations`
All club profile fields plus:
- `herbalife_level TEXT` — full level string e.g. `Presidents Team 30K 2 💎`, `Chairmans Club 7 💎`, `Founders Circle 12 💎`
- `story_why`, `story_favorite_part`, `story_favorite_products`, `story_unique`, `story_before`, `story_goal` — story question answers
- `owner_photo_url`, `owner2_photo_url`, `owner3_photo_url` — circular profile photos
- `logo_url`, `photo_urls` — club logo and photo gallery
- `survey_upline`, `survey_hl_month`, `survey_hl_year` — vetting survey
- `survey_active_club BOOLEAN`, `survey_club_month`, `survey_club_year`
- `survey_trainings TEXT` — comma-separated: local,zoom,sts,regional,extrav,all
- `survey_hear_how TEXT`, `survey_hear_detail TEXT`
- `survey_goal TEXT`
- `survey_completed_at TIMESTAMPTZ`

### `user_terms_acceptance`
- `user_id`, `accepted_at`, `onboarding_done BOOLEAN`, `pending_survey TEXT`

### `app_settings` (id=1 only)
- `welcome_video_enabled`, `welcome_video_url`, `welcome_video_placeholder`
- `welcome_title`, `welcome_message`, `welcome_disclaimer`
- `require_approval BOOLEAN`
- `demo_population`, `demo_income`, `demo_age_fit`, `demo_poverty`, `demo_competition`
- `demo_unemployment`, `demo_households`, `demo_median_age`, `demo_health`
- `demo_spending`, `demo_growth`, `demo_commute`, `demo_competitors`
- `col_widths TEXT` — JSON array of admin Members table column widths, persists across devices

### `contact_submissions` + `contact_replies`
### `notifications` (type, title, body, user_id, is_read)

### RLS Notes
- `app_settings`: authenticated users can SELECT, INSERT, and UPDATE (insert policy added in migration-011)
- `locations`: users can only update their own row

---

## Migrations (run in order)
| File | Description |
|------|-------------|
| `migration-006-owner-photos.sql` | owner_photo_url fields |
| `migration-007-welcome-disclaimer.sql` | welcome_disclaimer column |
| `migration-008-terms-accepted.sql` | user_terms_acceptance table + onboarding_done |
| `migration-009-col-widths.sql` | app_settings.col_widths |
| `migration-010-vetting-survey.sql` | All survey_* columns on locations + pending_survey on user_terms_acceptance |
| `migration-011-settings-rls-fix.sql` | INSERT policy for app_settings + all missing columns |

**Also needed (run manually if not done):**
```sql
ALTER TABLE locations ADD COLUMN IF NOT EXISTS herbalife_level TEXT DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS story_before TEXT DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS story_goal TEXT DEFAULT NULL;
```

---

## Supabase Edge Function
**`check-email-exists`** — queries `auth.users` to verify email exists before sending password reset. Deployed to Supabase.

---

## Email Templates (in zip root)
Paste into Supabase Auth Templates (Auth > Email Templates):
- `email-confirm-signup.html`
- `email-reset-password.html`
- `email-change-email.html`

Branded dark green with large CTA buttons.

---

## Feature Details

### Signup & Auth Flow
1. `/signup` — email + password + terms checkbox
2. Confirmation email → user clicks link
3. Redirects to `/onboarding` (card-by-card vetting survey)
4. After survey (or skipping) → `/app/profile`
5. Profile saved → pending approval → admin approves → visible on map/directory
- Google + Facebook OAuth also supported
- Forgot password uses `check-email-exists` edge function before sending reset

### OnboardingPage (`/onboarding`)
Card-by-card survey shown once after email confirmation. Skippable but data is captured if entered. Cards:
1. Welcome
2. Who is your upline?
3. How long Herbalife member? (month optional + year)
4. Actively operating a club? (Yes/No) → if Yes, club tenure fields appear inline
5. Trainings attended (multi-select checkboxes): local events, Zoom calls, STS, regional quarterly, Extravaganza, All of the above
6. How did you hear about this platform? (radio: upline told me, club owner, zoom call, at an event, Other + text field)
7. Primary goal for joining (textarea)
8. Done — "pending review" message + "Set up my club" CTA

On completion, `onboarding_done = true` saved to `user_terms_acceptance`. Survey answers saved to `locations` if profile exists, else to `pending_survey` in `user_terms_acceptance`. Page skips straight to `/app/profile` if `onboarding_done` is already true.

### ProfilePage — Key Features

**Herbalife Level Picker** (Card 5, required field)
Three-tier system with Option C confirm flow:
- **Future Tab Team:** DS, SB, SP (green), WT, AWT (gray)
- **Future Pres Team 🚀:** GT (red), GP (amber), MT (teal), MP (light blue)
- **Pres Team 💎:** single PT button → K level sub-picker (PT=base, 15K–150K) → optional diamonds 1–4
- **Chairman's & Founders 🥈✦:** single CC/FC button → K level (CC=base CC 5💎min, FC=base FC 10💎min, or 15K–150K) → required diamonds 5–15 (auto-labels CC for 5–9, FC for 10–15)

Confirm flow (Option C):
- All required selections made → dark green "Confirm level: [label]" button appears
- On confirm → picker dims with overlay, green locked state bar shows "Level confirmed: PT 30K 2 💎" + "Change" button
- Save disabled until confirmed
- On load: restores all selections from saved herbalife_level and starts in confirmed/locked state

Stored value format: `Presidents Team 30K 2 💎`, `Chairmans Club 7 💎`, `Founders Circle 100K 12 💎`

**Story Questions** (Card 6, all optional) — in this order:
1. Why did you decide to open your club?
2. What is your favorite part of club ownership?
3. What did you do for work (your former occupation) before owning your club?
4. What is your next big goal in Herbalife?
5. What are your favorite products?
6. What is something unique and interesting about yourself?

**Member Survey** (Card 7, persistent "Incomplete" badge)
Same questions as onboarding survey. Amber "Incomplete" badge disappears only when ALL fields have something in them. Pre-fills from onboarding answers. Always visible so answers can be updated.

**Unsaved Changes Detection**
`savedFormRef` snapshots form on load and after each save. `isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current)`. Save bar:
- Default: plain white sticky bar with Save buttons
- When dirty: amber top border, warm yellow background, "⚠ Unsaved changes" alert on left

**Other profile features:**
- CropModal (canvas circle crop) for logo + all 3 owner photos — drag/zoom/save
- Club photos drag-to-reorder (first = cover badge), fullscreen PhotoGallery modal
- Address autocomplete
- TimePicker — hours in numerical order 1–12, 15-min intervals, AM/PM
- Hours copy modal (to-do — not yet built)

### MapPage — Key Features
- Circle markers: red=yours, periwinkle=others, gold=selected
- Clean + Aerial base maps
- Market Data Research Mode: crosshair cursor, pulsing SVG reticle, dark green header, Exit button
- My Club card: collapsed by default, reduced size (~2/3 original height — logo 28px, padding 7px 10px)
- PhotoGallery: cover photo → fullscreen modal, keyboard nav
- Demographics panel: 6 data sources, user preferences, admin toggles

### DirectoryPage — Full Rewrite
**Default state:** All cards hidden. Empty state with search icon: "Search or filter to find clubs"

**Controls bar:** Search input | Sort (Name/City/Newest/Oldest) | Filter by state | Filter by level | "✕ Clear" button

**Cards:** Collapsed by default when results load. Toggle to expand.

**Collapsed header shows:** Logo/initials (32px) | Club name | Street address, City, State

**Expanded card shows:**
- Owner rows: circular profile photo (32px, if filled) | "Primary Owner" / "Co-Owner" bold title | Owner name | Level pill (condensed format)
- Level pill condensed: Presidents Team → PT, Chairmans Club → CC, Founders Circle → FC, etc.
- Phone + email as plain text (not clickable)
- Website (clickable) + Instagram (clickable) if filled
- Hours: condensed format — consecutive days with same hours grouped (Mon–Fri 7:00 AM – 3:00 PM)
- Day dots below hours
- Footer: Since [month] [year] + social links (FB, TK, YT)
- "Edit my profile →" for your own card

### AdminPage — Key Features

**Tab order:** Settings | Messages | Members (Settings is default tab)

**Settings Tab:**
- Welcome modal controls (video, title, message, disclaimer, placeholder)
- Require approval toggle
- Demographics category toggles (13)
- Preview buttons for message and disclaimer
- **Unsaved changes detection:** same dirty/alert bar as ProfilePage. `savedSettingsRef` snapshots on load and after save. Fixed RLS (insert policy added) and explicit field list in save payload.

**Messages Tab:**
- Contact sub-tab: unread dot/badge, mark read, reply via Brevo
- Member Activity sub-tab: new_signup, new_profile, pending_approval notifications
- Real-time Supabase subscriptions
- Red unread badge on tab

**Members Tab:**
- Desktop table with **resizable columns** — drag handle on right edge of each header, green highlight on hover
- Column widths saved to `app_settings.col_widths` as JSON on drag-end, loaded on page open (persists across devices)
- Table width = sum of column widths, wrapper scrolls horizontally
- Default column widths: [48, 160, 130, 120, 120, 180, 80, 90, 120, 90, 100]
- 11 columns: Logo | Club name | Owner | City/State | Phone | Email | Opened | Hours | Status | Joined | Actions
- Mobile: card tap-to-expand
- Member detail modal shows: level badge, survey answers (to-do — surface survey data)
- Approve / Revoke / Remove inline actions

---

## Herbalife Level System — Full Reference

### Stored value format
`[Tier] [K level] [diamonds] 💎`
- `Presidents Team` (base PT, no K)
- `Presidents Team 30K` (PT with K level, no diamonds)
- `Presidents Team 30K 2 💎` (PT with K and diamonds)
- `Chairmans Club` (base CC = 5 diamonds minimum)
- `Chairmans Club 30K 7 💎`
- `Founders Circle 100K 12 💎`

### Condensed display (used in directory pill, admin badge)
| Full | Short |
|------|-------|
| Presidents Team | PT |
| Chairmans Club | CC |
| Founders Circle | FC |
| Millionaire Team 7500 | MP |
| Millionaire Team | MT |
| Get Team 2500 | GP |
| Get Team | GT |
| Active World Team | AWT |
| World Team | WT |
| Supervisor | SP |
| Success Builder | SB |
| Distributor | DS |

### Diamond ranges
- PT: 1–4 💎 (optional)
- CC: 5–9 💎 (required for FCCC tier)
- FC: 10–15 💎 (required for FCCC tier)

### K levels (15K increments)
PT=base, 15K, 20K, 30K, 40K, 50K, 60K, 70K, 80K, 90K, 100K, 110K, 120K, 130K, 140K, 150K

---

## Pending To-Do List

### Profile
- Modal for copying hours to multiple days

### Admin
- Surface vetting survey answers in member detail card (data saves, need to display it)
- New member approval — send nudge email if survey incomplete

### Auth / Login
- New welcome message for returning users on login

### Mobile Overhaul *(tabled for end)*
- Full mobile-friendly pass including map club detail on tap

### Major Upcoming Feature — Public Club Finder
- Homepage redesign (public-facing)
- Customer-facing address search
- Nearest clubs list with distance
- Club info cards: name, address, distance, hours, Google Maps directions, social links, website
- Radius/distance filter options
- Public user login to save favorites
- Member login moves to navigation

---

## Known Issues / Notes
- `app_settings` upsert previously failed silently due to missing INSERT RLS policy — fixed in migration-011
- `herbalife_level` confirmation state (`lvlConfirmed`) is local React state — does not persist across page refreshes intentionally (user must re-confirm if they reload mid-edit without saving)
- `pending_survey` in `user_terms_acceptance` stores JSON for users who complete onboarding before setting up their profile — needs to be applied to `locations` on first profile save (not yet implemented — survey data may sit in pending_survey if user skips profile setup)
- Survey "Incomplete" badge in ProfilePage: `survey_active_club` can be boolean or string ('true'/'false') depending on how it was saved — comparison handles both

---

## Environment Variables (Vercel)
```
VITE_SUPABASE_URL=https://ulezfnzqwebkupgxqprs.supabase.co
VITE_SUPABASE_ANON_KEY=[anon key]
VITE_CENSUS_API_KEY=[census key]
```
