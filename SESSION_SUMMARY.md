# My Club Locator — Session Summary
**Last updated:** April 11, 2026
**Sessions completed:** 02

---

## ⚡ Core Development Principles

These apply to every session, every feature, every file:

1. **Mobile-first always** — Design and build for small screens first. Desktop is an enhancement, not the baseline. Every component, layout, and interaction must work well on a phone before anything else.
2. **Always deliver the full zip** — At the end of every session (and whenever files are updated), Claude delivers the complete `my-club-locator.zip` containing the full repo. This makes GitHub uploads straightforward.
3. **Session summary stays current** — This file is updated at the end of every session to reflect the true current state of the app, pending items, and any config steps needed.

---

## Project overview

**My Club Locator** is a private, login-gated web app for independently owned nutrition club operators. Each member registers their location via a profile page. All registered locations appear as pins on a shared interactive map. Built for Jeffrey's network marketing sales organization.

**Live URL:** https://clubregistry.vercel.app
**Vercel project:** https://vercel.com/empowercouple24s-projects/clubregistry
**Supabase URL:** https://ulezfnzqwebkupgxqprs.supabase.co
**Supabase account:** Separate second account (not Jeffrey's primary)
**GitHub repo:** Private — clubregistry

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Auth + Database | Supabase |
| Mapping | Leaflet (react-leaflet) |
| Geocoding | OpenStreetMap Nominatim (free, no key) |
| Hosting | Vercel |
| Email (SMTP) | Resend (configured session 02) |

---

## Current file structure

```
clubregistry-main/
├── index.html
├── vite.config.js
├── package.json
├── vercel.json
├── supabase-schema.sql        ← includes app_settings table (added session 02)
├── DEPLOY.md
├── SESSION_SUMMARY.md
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── lib/
    │   ├── supabase.js
    │   └── AuthContext.jsx    ← includes isAdmin flag (session 02)
    ├── components/
    │   ├── Layout.jsx         ← includes WelcomeModal + Admin nav link
    │   └── WelcomeModal.jsx   ← new session 02
    └── pages/
        ├── LoginPage.jsx      ← password visibility toggle, forgot password link
        ├── SignupPage.jsx     ← password visibility toggle
        ├── ForgotPasswordPage.jsx   ← new session 02
        ├── ResetPasswordPage.jsx    ← new session 02
        ├── MapPage.jsx        ← full rewrite session 02: panel, filters, radius, base maps
        ├── DirectoryPage.jsx
        ├── ProfilePage.jsx
        └── AdminPage.jsx      ← new session 02
```

---

## What's been built (cumulative)

### Auth
- ✅ Email + password login and signup
- ✅ Password visibility toggle on all password fields
- ✅ Forgot password flow (`/forgot-password` → email → `/reset-password`)
- ✅ Custom branded HTML email templates for: signup confirmation, password reset, email change
- ✅ SMTP via Resend (configured in Supabase — removes rate limit)
- ✅ Admin role detection via `ADMIN_USER_IDS` array in `AuthContext.jsx`

### Map (major session 02 rewrite)
- ✅ Full-screen Leaflet map
- ✅ Click any pin → slide-in detail panel on the right (stacks below on mobile)
- ✅ Selected pin turns gold; your pin is blue; others are green
- ✅ Detail panel shows: name, city, address, phone, website, hours, social links
- ✅ If viewing your own club → "✏️ Manage My Club" CTA button in panel
- ✅ If viewing another club → read-only panel
- ✅ Radius search tool lives inside the detail panel (presets: 1, 2, 5, 10 mi + custom)
- ✅ Radius circle drawn on map when active
- ✅ City/state filter with geocoding (search bar top-center of map)
- ✅ Base map toggle: Clean (CartoDB) / Street (OSM) / Aerial (Esri) / Topo
- ✅ Club count badge (updates when filters active)
- ✅ Real-time updates via Supabase subscription

### Welcome modal
- ✅ Shows once per user on first login (localStorage flag per user ID)
- ✅ Reads title, message, video URL, and video toggle from `app_settings` table in Supabase
- ✅ Two CTAs: "Add / Manage My Club" → /profile, "Explore the Map" → dismisses
- ✅ Video iframe embed (YouTube/Vimeo embed URL format)

### Admin page (`/admin`)
- ✅ Only visible/accessible to admin user(s)
- ✅ Admin badge appears in top nav for admin accounts
- ✅ Toggle welcome video on/off
- ✅ Set video embed URL
- ✅ Customize welcome modal title and message text
- ✅ Settings saved to `app_settings` table in Supabase

### Profile & Directory
- ✅ Editable profile: business name, address, city, state/zip, phone, website
- ✅ Hours of operation (per-day open/close grid)
- ✅ Social media links: Facebook, Instagram, TikTok, YouTube
- ✅ Auto-geocodes address to lat/lng on save
- ✅ Row-level security: users can only edit their own row
- ✅ Directory page: card grid of all registered clubs

### Email templates (paste into Supabase → Authentication → Email Templates)
- ✅ Confirm signup (`confirm-signup-email.html`)
- ✅ Reset password (`reset-password-email.html`)
- ✅ Change email (`change-email-email.html`)

---

## Config steps still needed

| Step | Where | Notes |
|---|---|---|
| Add your Supabase user ID | `src/lib/AuthContext.jsx` line 7 | Replace `'REPLACE_WITH_YOUR_SUPABASE_USER_ID'` — find it in Supabase → Auth → Users |
| Run `app_settings` SQL | Supabase → SQL Editor | Paste the bottom block from `supabase-schema.sql` |
| Set Supabase Site URL | Supabase → Auth → URL Configuration | Set to `https://clubregistry.vercel.app` |
| Add redirect URL | Same place as above | Add `https://clubregistry.vercel.app/reset-password` |
| Paste email templates | Supabase → Auth → Email Templates | 3 templates: confirm signup, reset password, change email |

---

## Pending / discussed but not yet built

- **Google / Facebook OAuth login** — requires Google Cloud Console + Facebook Developer app setup
- **Member approval flow** — admin approves new signups before they appear on map
- **Admin member management** — view all members, remove a member, see who has/hasn't filled profile
- **Profile photo upload** — Supabase Storage
- **Club description field** — short "about" blurb on profile
- **Custom domain** — connect via Vercel Settings → Domains
- **Password reset flow** — built but needs Supabase Site URL set to work end-to-end

---

## Known issues / watch items

- `REPLACE_WITH_YOUR_SUPABASE_USER_ID` placeholder must be filled in `AuthContext.jsx` before admin works
- Email confirmation is currently disabled in Supabase — fine for internal use
- Supabase URL is in client-side code by design — not a security risk

---

## Session workflow

- **Start of session:** Upload current repo zip → Claude unpacks and reads all files for full context
- **During session:** Claude delivers full `my-club-locator.zip` after every meaningful update
- **End of session:** Claude updates this SESSION_SUMMARY.md before final zip delivery
- **Context management:** Claude will flag when context window is getting full and recommend starting a new chat
