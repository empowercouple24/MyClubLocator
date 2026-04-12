-- Add insert policy (drop first if it already exists)
drop policy if exists "Authenticated users can insert settings" on public.app_settings;

create policy "Authenticated users can insert settings"
  on public.app_settings for insert
  to authenticated with check (true);

-- Ensure the row exists
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Add any missing columns
alter table public.app_settings add column if not exists welcome_disclaimer text default '';
alter table public.app_settings add column if not exists welcome_video_placeholder text default 'https://www.youtube.com/embed/dQw4w9WgXcQ';
alter table public.app_settings add column if not exists require_approval boolean default false;
alter table public.app_settings add column if not exists demo_population boolean default true;
alter table public.app_settings add column if not exists demo_income boolean default true;
alter table public.app_settings add column if not exists demo_age_fit boolean default true;
alter table public.app_settings add column if not exists demo_poverty boolean default true;
alter table public.app_settings add column if not exists demo_competition boolean default true;
alter table public.app_settings add column if not exists demo_unemployment boolean default true;
alter table public.app_settings add column if not exists demo_households boolean default true;
alter table public.app_settings add column if not exists demo_median_age boolean default true;
alter table public.app_settings add column if not exists demo_health boolean default true;
alter table public.app_settings add column if not exists demo_spending boolean default true;
alter table public.app_settings add column if not exists demo_growth boolean default true;
alter table public.app_settings add column if not exists demo_commute boolean default true;
alter table public.app_settings add column if not exists demo_competitors boolean default true;
alter table public.app_settings add column if not exists col_widths text default null;
