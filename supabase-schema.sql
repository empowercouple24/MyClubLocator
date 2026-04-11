-- ============================================================
-- My Club Locator — Supabase Schema
-- ============================================================
-- HOW TO USE THIS FILE:
--
-- SECTION 1 — Initial Setup (run ONCE when first creating the project)
-- SECTION 2 — Migrations (run only the NEW block when prompted by Claude)
--
-- Never re-run Section 1 if your tables already exist.
-- Only run the specific migration block that's new to you.
-- ============================================================


-- ============================================================
-- SECTION 1: INITIAL SETUP
-- Run this once when setting up a brand new Supabase project.
-- ============================================================

-- Locations table
create table if not exists public.locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Owner info
  first_name text,
  last_name text,
  owner2_first_name text,
  owner2_last_name text,
  owner2_email text,
  owner2_phone text,

  -- Club info
  business_name text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  state_zip text,   -- legacy combined field, kept for compatibility
  website text,

  -- When opened
  opened_month text,
  opened_year text,

  -- Geocoded coordinates (auto-set on save from the app)
  lat double precision,
  lng double precision,

  -- Hours of operation (open/close per day, stored as HH:MM strings)
  hours_monday_open text,    hours_monday_close text,
  hours_tuesday_open text,   hours_tuesday_close text,
  hours_wednesday_open text, hours_wednesday_close text,
  hours_thursday_open text,  hours_thursday_close text,
  hours_friday_open text,    hours_friday_close text,
  hours_saturday_open text,  hours_saturday_close text,
  hours_sunday_open text,    hours_sunday_close text,

  -- Social media
  social_facebook text,
  social_instagram text,
  social_tiktok text,
  social_youtube text
);

-- Auto-update the updated_at timestamp on every save
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_locations_updated
  before update on public.locations
  for each row execute procedure public.handle_updated_at();

-- Row Level Security
alter table public.locations enable row level security;

create policy "Authenticated users can read all locations"
  on public.locations for select
  to authenticated using (true);

create policy "Users can insert their own location"
  on public.locations for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own location"
  on public.locations for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own location"
  on public.locations for delete
  to authenticated using (auth.uid() = user_id);

-- Enable Realtime
alter publication supabase_realtime add table public.locations;


-- App settings table
create table if not exists public.app_settings (
  id integer primary key default 1,
  welcome_video_enabled boolean default false,
  welcome_video_url text default '',
  welcome_title text default 'Welcome to My Club Locator!',
  welcome_message text default 'You''re now part of the network. Watch the video below to get started, then add your club to the map.',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create policy "Authenticated users can read settings"
  on public.app_settings for select
  to authenticated using (true);

create policy "Authenticated users can update settings"
  on public.app_settings for update
  to authenticated using (true);


-- ============================================================
-- SECTION 2: MIGRATIONS
-- Run ONLY the specific block marked as new when Claude
-- instructs you to. Skip any blocks already applied.
-- ============================================================

-- ── Migration 001 (Session 02) ── already applied ──────────
-- Adds owner name fields, second owner, separate zip/state,
-- and club opened month/year.
--
-- alter table public.locations
--   add column if not exists first_name text,
--   add column if not exists last_name text,
--   add column if not exists owner2_first_name text,
--   add column if not exists owner2_last_name text,
--   add column if not exists owner2_email text,
--   add column if not exists owner2_phone text,
--   add column if not exists zip text,
--   add column if not exists state text,
--   add column if not exists opened_month text,
--   add column if not exists opened_year text;
-- ── End Migration 001 ───────────────────────────────────────


-- Future migrations will be added here as:
-- ── Migration 002 (Session XX) ── [status] ─────────────────
-- Description of what it adds
-- SQL goes here
-- ── End Migration 002 ──────────────────────────────────────

-- ── Migration 002 (Session 02) ── RUN THIS NOW ──────────────
-- Adds owner email, club email, photo URLs, and story prompts

alter table public.locations
  add column if not exists owner_email text,
  add column if not exists club_email text,
  add column if not exists club_phone text,
  add column if not exists logo_url text,
  add column if not exists photo_urls text[],
  add column if not exists story_why text,
  add column if not exists story_favorite_part text,
  add column if not exists story_favorite_products text,
  add column if not exists story_unique text;

-- Create storage bucket for club photos (run this too)
insert into storage.buckets (id, name, public)
  values ('club-photos', 'club-photos', true)
  on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
create policy "Users can upload club photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'club-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone authenticated to read club photos
create policy "Authenticated users can view club photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'club-photos');

-- Allow users to delete their own photos
create policy "Users can delete their own club photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'club-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── End Migration 002 ───────────────────────────────────────
