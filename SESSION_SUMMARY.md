# My Club Locator — Session Summary
**Last updated:** April 11, 2026
**Sessions completed:** 03

---

## ⚡ Core Development Principles

These apply to every session, every feature, every file:

1. **Mobile-first always** — Design and build for small screens first. Desktop is an enhancement, not the baseline. Every component, layout, and interaction must work well on a phone before anything else.
2. **Always deliver the full zip** — After every meaningful update, Claude delivers the complete `my-club-locator.zip` containing the full repo. This makes GitHub uploads straightforward.
3. **Ask before building** — Before starting any new feature, Claude confirms the user is ready to build. No surprises.
4. **Session summary stays current** — This file is updated at the end of every session to reflect the true current state of the app, pending items, and any config steps needed.

---

## Project overview

**My Club Locator** is a private, login-gated web app for independently owned nutrition club operators. Each member registers their location via a profile page. All registered locations appear as pins on a shared interactive map. Built for Jeffrey's network marketing sales organization.

**Live URL:** https://clubregistry.vercel.app
**Vercel project:** https://vercel.com/empowercouple24s-projects/clubregistry
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**Supabase account:** Separate second account (not Jeffrey's primary)
**GitHub repo:** Private — clubregistry
**Admin user ID:** ed1f34a7-7838-4d01-a29c-63220c43e9f1

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Auth + Database | Supabase |
| Mapping | Leaflet (react-leaflet) |
| Geocoding | OpenStreetMap Nominatim (free, no key) |
| Demographics | US Census ACS 2022 API (free, no key) |
| Hosting | Vercel |
| Email (SMTP) | Resend (configured) |

---

## Current file structure

```
clubregistry-main/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── supabase-schema.sql
├── DEPLOY.md
├── SESSION_SUMMARY.md
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── lib/
    │   ├── supabase.js
    │   ├── AuthContext.jsx          ← isAdmin flag, Jeffrey's user ID set
    │   └── demographics.js          ← Census API service, market score calc
    ├── components/
    │   ├── Layout.jsx               ← UpdateBanner, WelcomeModal, Admin nav
    │   ├── UpdateBanner.jsx         ← 15s GitHub deploy check
    │   ├── WelcomeModal.jsx         ← First-login modal, reads from Supabase
    │   ├── TimePicker.jsx           ← Custom 15-min interval time picker
    │   ├── AddressAutocomplete.jsx  ← Live address lookup as-you-type
    │   └── DemographicsPanel.jsx    ← Market data widget for map panel
    └── pages/
        ├── LoginPage.jsx            ← Eye toggle, forgot password link
        ├── SignupPage.jsx           ← Eye toggle
        ├── ForgotPasswordPage.jsx
        ├── ResetPasswordPage.jsx
        ├── MapPage.jsx              ← Full rewrite: always-visible panel, demo toggle
        ├── DirectoryPage.jsx        ← Rich cards: logo, owners, hours, socials
        ├── ProfilePage.jsx          ← Full profile flow: owners, photos, story
        └── AdminPage.jsx            ← Members tab + Settings tab
```

---

## What's been built (cumulative)

### Auth
- ✅ Email + password login and signup
- ✅ Password visibility toggle on all password fields
- ✅ Forgot password / reset password flow
- ✅ Custom branded HTML email templates (signup confirm, password reset, email change)
- ✅ SMTP via Resend (no rate limits)
- ✅ Admin role detection via user ID in AuthContext

### Map (major overhaul)
- ✅ Always-visible dashboard panel (never hides)
- ✅ Panel position per user: Left / Right / Bottom — saved to localStorage, defaults Right
- ✅ Pinned "My Club" card always at top of panel (logo, name, city, since date, edit button)
- ✅ Dynamic club detail fills bottom section on pin click
- ✅ Club detail shows: logo/initials, all owners, contact, hours (formatted AM/PM), social links
- ✅ "Manage My Club" CTA only shows when viewing your own club
- ✅ City/state filter with geocoding (search bar)
- ✅ Radius search: presets (1/2/5/10 mi) + custom — lives in club detail section
- ✅ Base map toggle: Clean / Street / Aerial / Topo
- ✅ Hover tooltip on pins: club name, owner, address
- ✅ Unapproved clubs hidden from map
- ✅ Real-time updates via Supabase subscription

### Demographics / Market Data
- ✅ 📊 Market Data toggle button in map toolbar
- ✅ Click-to-load: prompts "select an area", loads on map click
- ✅ Reverse geocodes click to ZIP + county via Census geocoder
- ✅ Fetches ZIP-level: population, income, poverty rate, unemployment, households
- ✅ Fetches county-level: age breakdown, per capita income, age fit % (18–49)
- ✅ Auto-weighted market score → letter grade (A+ through F) + numeric score subtitle
- ✅ Signal tags: "Strong income", "Great age fit", "2 clubs nearby", etc.
- ✅ Club competition section: nearby club list + saturation (clubs per 10k people)
- ✅ Source note: county-level data flagged clearly
- ✅ Admin toggles per data category (7 switches in Settings tab)

### Profile (5 cards)
- ✅ Card 1 — Owners: primary + optional owner 2 + owner 3, each with first/last/email
- ✅ Card 2 — Club Info: name, email (required), phone, website, address with ZIP autocomplete
- ✅ Card 3 — Club Specifics: opened month/year, hours with custom TimePicker (15-min intervals, AM/PM defaults), social media
- ✅ Card 4 — Club Photos: logo upload + up to 6 club photos (Supabase Storage)
- ✅ Card 5 — Your Story: 4 optional prompts
- ✅ Address autocomplete (live lookup as you type), city/state auto-filled from ZIP, read-only
- ✅ Hours copy tool: copy one day's hours to selected other days
- ✅ Validation with inline errors on all required fields
- ✅ Two save buttons: Save My Profile / Save & Return to Map

### Directory
- ✅ Rich cards: logo/initials, club name, city, owner names, address, contact links, hours summary, day dots, since date, social badges
- ✅ Sort: Name A–Z, City A–Z, Newest first, Oldest first
- ✅ Search by name, city, owner name
- ✅ Your club gets green border + tap-to-edit prompt

### Admin panel (two tabs)
- ✅ Members tab:
  - 4 stat cards (total, complete, incomplete, pending)
  - Filter by profile status + approval status + search
  - Per-member: Approve / Revoke / Remove actions
  - Remove triggers confirmation modal
  - Your own account protected from removal
  - Unapproved clubs hidden from map
- ✅ Settings tab:
  - Welcome modal controls (title, message, video URL, video on/off)
  - Require approval toggle for new members
  - Demographics section: 7 category toggles

### Welcome modal
- ✅ Shows once per user on first login (localStorage)
- ✅ Two CTAs: Add/Manage My Club → /profile, Explore the Map → dismiss
- ✅ Optional video embed (YouTube/Vimeo)
- ✅ All content controlled from Admin → Settings

### Update banner
- ✅ Checks for new Vercel deploys every 15 seconds
- ✅ Slides in banner: "A new version is available — Refresh"
- ✅ Only active on live site (silent on localhost)

### Email templates (in Supabase → Auth → Email Templates)
- ✅ Confirm signup
- ✅ Reset password
- ✅ Change email

---

## Supabase migrations status

| Migration | Description | Status |
|---|---|---|
| Initial setup | locations table, RLS, realtime, app_settings | ✅ Applied |
| Migration 001 | first/last name, owner2/3, zip, state, opened fields | ✅ Applied |
| Migration 002 | owner_email, club_email, photo URLs, story prompts, storage bucket | ✅ Applied |
| Migration 003 | owner3 fields | ✅ Applied |
| Migration 004 | approved, approved_at, approved_by + admin RLS policies | ⚠️ Run this |
| Migration 007 | welcome_disclaimer, welcome_video_placeholder columns in app_settings | ⚠️ Run this |

---

## Config completed ✅

- Supabase Site URL set to https://clubregistry.vercel.app
- Redirect URL set to https://clubregistry.vercel.app/reset-password
- Email templates pasted in (all 3)
- SMTP via Resend configured
- Admin user ID set in AuthContext.jsx
- Email confirmation disabled (fine for internal tool)

---

## To-do for next session (top priority)

### Profile Page
- ✅ **Move website field** — removed from Club Info, added to Social Media section
- ✅ **Auto-format phone numbers** — `(###) ###-####` as user types on all phone fields
- ✅ **Owner profile photos in settings** — primary, owner 2, owner 3 each have photo upload (requires Migration 006)
- ✅ **Sticky save bar** — Save My Profile / Save & Return to Map fixed to bottom of screen

### Map — Dashboard Panel
- ✅ **Dashboard phone formatting** — displays as `(###) ###-####` in club detail panel
- ✅ **Disable mailto on email** — club email shown as plain text, not a clickable link
- ✅ **Dashboard: club open since** — shows "Open since Month Year" in club detail header
- ✅ **Owner profile photos in dashboard** — circular avatar next to each owner name; falls back to 👤 icon
- ✅ **Radius presets update** — changed to 3 mi, 10 mi, 20 mi, 30 mi

### Map — Pins & Tooltips
- ✅ **Hover tooltip: both owners + open since** — all owner names + "Open since Month Year" shown in tooltip
- ✅ **Club logo in hover tooltip** — logo image (or initials fallback) displayed in tooltip header; white card design with black text
- ✅ **Map pin emoji** — replaced Leaflet markers with 📍 DivIcon pins; teal tint = your club, green tint = others, gold tint = selected

### Map — UI & Controls
- ✅ **Auto-load market data on pin click** — clicking any pin automatically activates the demo panel and loads data for that club's coordinates
- ✅ **Remove Topo base map** — only Clean / Street / Aerial remain
- ✅ **Panel position toggle** — replaced arrow emoji with SVG layout icons showing the panel position visually (left/bottom/right block diagrams)
- ✅ **Set default map extent** — "Set Default View" button (⭐) saves current center + zoom to localStorage per user; loads automatically on next visit with a confirmation toast

---

## Pending / not yet built

- **Google / Facebook OAuth login** — requires Google Cloud Console + Facebook Developer app
- **Custom domain** — connect via Vercel Settings → Domains
- **Password reset end-to-end verification** — built but not tested live yet
- **Demographics: health indicators** (CDC PLACES obesity/inactivity data) — discussed, not yet added
- **Demographics: spending behavior** (Census consumer expenditure) — discussed, not yet added
- **Map search bar address autocomplete** — built in profile, not yet added to map search

---

## Known items

- Migrations 004 and 005 still need to be run in Supabase SQL Editor
- The `chip` CSS class may have a stale reference — not used in new directory cards but harmless
- Photo upload requires Supabase Storage bucket `club-photos` to be created (Migration 002 includes this)

---

## Session workflow

- **Start of session:** Upload current repo zip → Claude unpacks and reads all files for full context
- **During session:** Claude delivers full `my-club-locator.zip` after every meaningful update
- **End of session:** Claude updates this SESSION_SUMMARY.md before final zip delivery
- **Context management:** Claude will flag when context window is getting full and recommend starting a new chat
- **Before building:** Claude always asks "Ready to build?" before starting any new feature
