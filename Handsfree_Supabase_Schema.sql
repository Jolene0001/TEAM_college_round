-- Handsfree Supabase schema
-- Run this in Supabase Dashboard > SQL Editor > New query.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  head_sensitivity integer not null default 6 check (head_sensitivity between 1 and 10),
  cursor_smoothing integer not null default 5 check (cursor_smoothing between 1 and 10),
  dwell_duration numeric not null default 1.2 check (dwell_duration between 0.5 and 3.0),
  gesture_sensitivity integer not null default 5 check (gesture_sensitivity between 1 and 10),
  voice_confirmation boolean not null default true,
  accidental_activation_protection boolean not null default true,
  visual_feedback boolean not null default true,
  reduced_motion boolean not null default false,
  head_enabled boolean not null default true,
  hands_enabled boolean not null default false,
  voice_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

create policy "Read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Create own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "Update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Read own preferences"
on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Create own preferences"
on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Update own preferences"
on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
