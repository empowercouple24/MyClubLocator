-- ============================================================
-- ClubRegistry — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Create the locations table
create table if not exists public.locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Business info
  business_name text,
  phone text,
  address text,
  city text,
  state_zip text,
  website text,

  -- Geocoded coordinates (auto-set on save from the app)
  lat double precision,
  lng double precision,

  -- Hours of operation (open/close per day, stored as HH:MM strings)
  hours_monday_open text,
  hours_monday_close text,
  hours_tuesday_open text,
  hours_tuesday_close text,
  hours_wednesday_open text,
  hours_wednesday_close text,
  hours_thursday_open text,
  hours_thursday_close text,
  hours_friday_open text,
  hours_friday_close text,
  hours_saturday_open text,
  hours_saturday_close text,
  hours_sunday_open text,
  hours_sunday_close text,

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

-- ============================================================
-- Row Level Security (RLS)
-- Users can only read/write their own row.
-- Anyone logged in can read all rows (for map + directory).
-- ============================================================

alter table public.locations enable row level security;

-- All authenticated users can read all locations (for map & directory)
create policy "Authenticated users can read all locations"
  on public.locations
  for select
  to authenticated
  using (true);

-- Users can only insert their own row
create policy "Users can insert their own location"
  on public.locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can only update their own row
create policy "Users can update their own location"
  on public.locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own row
create policy "Users can delete their own location"
  on public.locations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- Enable Realtime (so the map updates live when anyone saves)
-- ============================================================

alter publication supabase_realtime add table public.locations;

-- ============================================================
-- App Settings table (for admin-controlled platform settings)
-- Run this as a new query in Supabase SQL Editor
-- ============================================================

create table if not exists public.app_settings (
  id integer primary key default 1,
  welcome_video_enabled boolean default false,
  welcome_video_url text default '',
  welcome_title text default 'Welcome to My Club Locator!',
  welcome_message text default 'You''re now part of the network. Watch the video below to get started, then add your club to the map.',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Insert the default settings row
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- RLS: anyone authenticated can read settings
alter table public.app_settings enable row level security;

create policy "Authenticated users can read settings"
  on public.app_settings for select
  to authenticated using (true);

-- Only allow updates via service role (admin updates go through the app with admin check)
create policy "Authenticated users can update settings"
  on public.app_settings for update
  to authenticated using (true);

-- ============================================================
-- Migration: Profile enhancements
-- Run this in Supabase SQL Editor as a new query
-- ============================================================

alter table public.locations
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists owner2_first_name text,
  add column if not exists owner2_last_name text,
  add column if not exists owner2_email text,
  add column if not exists owner2_phone text,
  add column if not exists zip text,
  add column if not exists state text,
  add column if not exists opened_month text,
  add column if not exists opened_year text;
