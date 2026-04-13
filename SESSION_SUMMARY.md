# MyClubLocator — Session Summary
**Date:** April 13, 2026  
**Project:** myclublocator.com  
**Stack:** React + esbuild, Supabase, Leaflet/Mapbox, Vercel

---

## Work Completed This Session

### Admin Panel — Settings Tab Restructure
- Consolidated 10 individual expandable cards into **4 top-level cards**:
  1. **Welcome Messages, Member Approval, and Teams** — Welcome Modal, Login Welcome Messages, Team Creation, Member Approval
  2. **Public Finder Settings** — Finder messages + search radius
  3. **MyClubLocator Themes** — App Theme, Landing Page Appearance, Map Marker Colors
  4. **Demographics — Market Data** — unchanged
- Removed all inner expandable toggle headers; content shows directly with subtle uppercase section dividers
- Added `admin-card-body` CSS class (`padding: 0 20px 20px`) to all three card bodies — content no longer touches left/right edges
- Extracted `hexToHsl` / `hslToHex` / `genShades` color helpers to module level (previously trapped in iife wrappers per card)

### Admin Panel — Bug Fixes
- **Crash on load** — `card1Open`, `card2Open`, `card3Open` state vars were missing after rebuild script; added back
- **Sticky save bar false positive** — `isSettingsDirty` used full `JSON.stringify` comparison causing the bar to appear on every card toggle. Fixed to compare only keys present in `savedSettingsRef` (DB fields only)
- **"20 mi radius" subtitle color** — was hardcoded `#888` on the card header; now `var(--theme-card-header-text)` at 75% opacity
- **Chevron icon color** — was hardcoded `rgba(255,255,255,0.45)`; now `var(--theme-card-header-text)`
- **MyClubLocator Themes page takeover** — opening card3 triggered the live-apply `useEffect` which set `--theme-page-bg` on `documentElement`, flooding the entire admin page with the member theme background color. Fixed with `body:has(.admin-page-wrap) { background: #f0ede6 !important }` to lock admin background independently

### Admin Panel — Level Picker Upgrade
- Team creation minimum level picker now uses the same grouped `lvl-btn` component as Profile Settings
- Three groups: **Tab Team** (DS / SB / SP / WT / AWT) · **Future Pres Team 🚀** (GT / GP / MT / MP) · **Pres Team 💎** (PT)
- Color-tinted rest state, full color on selection
- Fixed **Millionaire Team 7500** abbreviation (`MP` was showing full name)

### Admin Panel — Rich Text Editor Fix
- Quill toolbar icons were rendering as large triangle/diamond shapes
- Root cause: `build.mjs` uses `loader: { '.css': 'empty' }` which silently drops all `import '*.css'` statements in JSX files
- Fix: Quill snow CSS (24KB) prepended directly into `src/index.css` so it bundles through esbuild normally

### Map — Preferences Panel (New)
- Replaced cluttered `map-controls-bottom` bar with a collapsible **Map Preferences Panel**
- **Collapsed trigger** — gear icon + label + live summary (e.g. "Zoom in · Right panel · Scroll zoom on")
- **Expanded rows**: On marker click · Panel side · Scroll zoom · Marker shapes
- **Marker shapes** — single-click cycle (dot → pin → diamond) per type, with color dot preview. Replaces 12-button grid
- **Views panel** — replaces separate "Saved Views" + "Set Default View" buttons with one unified panel:
  - ⭐ Default view row with "Set to current" button
  - Named view save input
  - Saved views list with fly-to + delete
- **My Team** filter remains visible in the collapsed trigger
- **Basemap toggle** stays below the panel, always visible
- **Layout fix** — `map-area` was `overflow: hidden`, clipping the panel completely. Changed to `display: flex; flex-direction: column`; `overflow: hidden` moved to the Leaflet container only
- **Gray edge fix** — `club-panel--collapsed` background was `transparent`, exposing Leaflet tile bleed; set to `#fff`

### Welcome Modal — Merge Tags
- `WelcomeModal.jsx` rewritten to fetch all clubs for the user and substitute merge tags at render time
- Tags: `{{first_name}}`, `{{club_1_name}}`, `{{club_2_name}}`, `{{club_3_name}}`, `{{club_1_city}}`, `{{club_2_city}}`, `{{club_3_city}}`
- Hint text shown under welcome message and disclaimer editors in admin
- Login message editors show `{name}` · `{club}` · `{club_2}` · `{club_3}` hints

---

## Build State
- **Command:** `node build.mjs` (esbuild — not Vite)
- **Status:** ✅ Clean

---

## Pending
- [ ] Google Maps "share to phone" on club cards (Web Share API + clipboard fallback)
- [ ] #9 Hours copy modal
- [ ] #13 Mobile overhaul

---

## Key Gotchas
- **CSS imports in JSX are silently dropped** by esbuild (`loader: { '.css': 'empty' }`). Always add CSS to `src/index.css` directly — never `import 'x.css'` in a component.
- **`body` uses `var(--theme-page-bg)`** — admin page overrides this with `body:has(.admin-page-wrap)`. Any new full-page view that should be theme-independent needs a similar override.
- **Supabase:** `https://ulezfnzqwebkupgxqprs.supabase.co` · Admin ID: `ed1f34a7-7838-4d01-a29c-63220c43e9f1`
- **Live:** `https://myclublocator.com` (Vercel project: `clubregistry`, team: `empowercouple24s-projects`)
