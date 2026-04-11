# ClubRegistry — Deployment Guide

Follow these steps in order. Estimated total time: ~45 minutes.

---

## Step 1 — Create your Supabase project (10 min)

1. Go to https://supabase.com and sign up (free)
2. Click **New project**, give it a name (e.g. `clubregistry`), choose a region close to you, set a database password
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** (left sidebar) → click **New query**
5. Open the file `supabase-schema.sql` from this project, paste the entire contents, and click **Run**
   - This creates your `locations` table, security rules, and realtime subscription
6. Go to **Settings > API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 2 — Configure your environment (2 min)

1. In the project folder, copy `.env.example` to a new file named `.env`
2. Fill in the two values you copied from Supabase:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

---

## Step 3 — Test locally (5 min)

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser.
- Sign up with a test email, fill in a profile, and confirm your pin appears on the map.

---

## Step 4 — Push to GitHub (5 min)

1. Create a new repository at https://github.com/new
   - Name it `clubregistry`
   - Set it to **Private**
   - Do NOT initialize with a README (you already have files)
2. In your terminal, from the project folder:

```bash
git init
git add .
git commit -m "Initial ClubRegistry app"
git remote add origin https://github.com/YOUR_USERNAME/clubregistry.git
git push -u origin main
```

---

## Step 5 — Deploy to Vercel (10 min)

1. Go to https://vercel.com and sign up (use "Continue with GitHub")
2. Click **Add New > Project**
3. Import your `clubregistry` GitHub repository
4. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Deploy**

Vercel will build and deploy your app. You'll get a URL like `clubregistry.vercel.app`.

---

## Step 6 — Connect your custom domain (15 min + DNS propagation)

1. In your Vercel project, go to **Settings > Domains**
2. Enter your domain (e.g. `clubregistry.com`) and click **Add**
3. Vercel will show you DNS records to add — typically:
   - An **A record** pointing to `76.76.21.21`
   - Or a **CNAME record** pointing to `cname.vercel-dns.com`
4. Log into your domain registrar (Namecheap, GoDaddy, Google Domains, etc.)
5. Find DNS settings and add the records Vercel specified
6. DNS changes take 10 minutes to 24 hours to propagate

Once propagated, your app is live at your custom domain with HTTPS automatically.

---

## Step 7 — Supabase auth settings (optional but recommended)

By default Supabase requires email confirmation before login. For an internal network app you may want to disable this:

1. In Supabase dashboard go to **Authentication > Settings**
2. Under **Email Auth**, toggle off **Enable email confirmations**

This lets new members sign up and get straight in without needing to check email first.

---

## Ongoing workflow

When you make changes to the code:
1. Edit files locally
2. `git add . && git commit -m "your message" && git push`
3. Vercel automatically detects the push and redeploys within ~30 seconds

---

## File structure reference

```
clubregistry/
├── index.html                  # App entry point
├── vite.config.js              # Vite bundler config
├── package.json                # Dependencies
├── .env.example                # Template for environment variables
├── .env                        # Your actual keys (never commit this)
├── supabase-schema.sql         # Run once in Supabase SQL editor
└── src/
    ├── main.jsx                # React entry, providers
    ├── App.jsx                 # Routes
    ├── index.css               # Global styles
    ├── lib/
    │   ├── supabase.js         # Supabase client
    │   └── AuthContext.jsx     # Login state provider
    ├── components/
    │   └── Layout.jsx          # Topbar + tab navigation
    └── pages/
        ├── LoginPage.jsx       # Login screen
        ├── SignupPage.jsx      # Signup screen
        ├── MapPage.jsx         # Interactive Leaflet map
        ├── DirectoryPage.jsx   # Card grid of all clubs
        └── ProfilePage.jsx     # Editable profile form
```
