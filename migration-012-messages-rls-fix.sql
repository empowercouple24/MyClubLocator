-- ── contact_submissions RLS ──────────────────────────────────
alter table public.contact_submissions enable row level security;

drop policy if exists "Admin can read contact submissions" on public.contact_submissions;
drop policy if exists "Admin can update contact submissions" on public.contact_submissions;
drop policy if exists "Anyone can insert contact submissions" on public.contact_submissions;

create policy "Anyone can insert contact submissions"
  on public.contact_submissions for insert
  to anon, authenticated with check (true);

create policy "Admin can read contact submissions"
  on public.contact_submissions for select
  to authenticated using (true);

create policy "Admin can update contact submissions"
  on public.contact_submissions for update
  to authenticated using (true);

-- ── notifications RLS ─────────────────────────────────────────
alter table public.notifications enable row level security;

drop policy if exists "Admin can read notifications" on public.notifications;
drop policy if exists "Admin can update notifications" on public.notifications;
drop policy if exists "Authenticated can insert notifications" on public.notifications;

create policy "Authenticated can insert notifications"
  on public.notifications for insert
  to authenticated with check (true);

create policy "Admin can read notifications"
  on public.notifications for select
  to authenticated using (true);

create policy "Admin can update notifications"
  on public.notifications for update
  to authenticated using (true);

-- ── Ensure is_read column exists and defaults to false ────────
alter table public.contact_submissions add column if not exists is_read boolean default false;
alter table public.notifications       add column if not exists is_read boolean default false;

-- Backfill any NULLs to false
update public.contact_submissions set is_read = false where is_read is null;
update public.notifications       set is_read = false where is_read is null;
