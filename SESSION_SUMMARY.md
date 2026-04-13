# MyClubLocator — Session Summary
**Date:** April 13, 2026  
**Project:** myclublocator.com  
**Stack:** React + esbuild, Supabase, Leaflet/Mapbox, Vercel

---

## Work Completed This Session

### 1. Share Location Button (Priority #1)
- **Web Share API** on mobile — opens native share sheet (iOS/Android)
- **Clipboard fallback** on desktop — copies Google Maps URL with "Link copied!" confirmation
- Added to **MapPage** `ClubDetail` panel (after photos section)
- Added to **PublicFinderPage** `ClubCard` (between directions + route buttons)
- Shared `ShareLocationButton` component defined independently in each page (no cross-import needed)
- Google Maps search URL format: `https://www.google.com/maps/search/?api=1&query=<address>`
- CSS: `.share-location-btn` with blue theme, green copied state

### 2. Hours Copy Modal (Priority #2 — Issue #9)
- **Cross-club hour copying** — when an owner has 2+ clubs, a "Copy hours from another club" button appears above the hours grid
- Clicking opens an inline panel listing other clubs (filtered to those with at least one day of hours set)
- Each club shows a preview of its first 2 days of hours
- One-click copies all 7 days of hours from the selected source club into the current form
- `allClubs` prop passed from parent `ProfilePage` to `ClubEditor`
- CSS: `.cross-club-copy-btn`, `.cross-club-copy-panel`, `.cross-club-copy-item`

### 3. Mobile Responsive Overhaul (Priority #3 — Issue #13)
Comprehensive CSS-only mobile pass added at end of `index.css`:

**Tablet (≤768px):**
- Topbar: email hidden, tighter padding
- Tabbar + admin tabs: horizontal scroll with hidden scrollbars
- Admin: 2-column stats grid, tighter padding

**Phone (≤600px):**
- Map: dvh-aware height, panel max-height 52vh, hidden panel-width toggle
- Club detail: compact spacing throughout
- Hours rows: flex-wrap enabled, smaller labels
- Address grid: single column
- Club tabs: horizontal scroll
- Profile cards: tighter padding throughout
- Finder panel: bottom-sheet max-height 55vh, compact typography
- Demographics: single-column widget grid
- Modals: near-full-screen with scroll
- Directory: forced single column, stacked controls

**Small phone (≤400px):**
- Hours rows: fully stacked (day label above pickers)
- Admin stats: single column
- Finder cards: smaller logos, tighter padding
- Minimal padding everywhere

**Touch & accessibility:**
- `pointer: coarse` — 44px minimum tap targets on buttons/tabs
- Larger checkboxes (20×20)
- Bigger map control buttons
- Safe area insets for notched phones (env(safe-area-inset-*))

### 4. Debug Console.log Cleanup (Priority #6)
- Removed all `[MarketData]` console.log statements from `MapPage.jsx` and `demographics.js`
- Removed all `[ClubEditor]` console.log statements from `ProfilePage.jsx`
- **Preserved** all `console.warn` and `console.error` calls (useful for production debugging)

---

## Build State
- **Command:** `rm -rf dist && node build.mjs`
- **Status:** ✅ Clean
- **JS:** 2.4mb (main-bundle.js)
- **CSS:** 178.8kb (index-ZUJMEZLI.css)

---

## Still Pending
- [ ] Verify 2nd/3rd club appears on map (depends on `VITE_MAPBOX_TOKEN` in Vercel)
- [ ] Confirm Supabase storage UPDATE policy applied for photo upserts on 2nd+ clubs
- [ ] Test Share button behavior on actual iOS/Android devices
- [ ] Test mobile layout on real devices (CSS-only changes — no JS mobile logic)

---

## Vercel Env Vars
| Key | Purpose | Status |
|-----|---------|--------|
| `VITE_SUPABASE_URL` | Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase | ✅ |
| `VITE_MAPBOX_TOKEN` | Map search + geocoding | ⚠️ Verify |
| `VITE_CENSUS_API_KEY` | Market Data | ✅ |
| `VITE_BREVO_API_KEY` | Email | ✅ |

---

## Key Gotchas
- Never `import 'x.css'` in JSX — esbuild drops it. Add to `src/index.css` only.
- `body` uses `var(--theme-page-bg)` — admin overrides with `body:has(.admin-page-wrap)`.
- Always `rm -rf dist` before build — stale CSS hashes cause wrong file pickup.
- **Supabase:** `https://ulezfnzqwebkupgxqprs.supabase.co` · Admin ID: `ed1f34a7-7838-4d01-a29c-63220c43e9f1`
- **Live:** `https://myclublocator.com` (Vercel: `clubregistry`, team: `empowercouple24s-projects`)
