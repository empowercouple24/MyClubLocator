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
