-- Drop old tables if they exist
drop table if exists public.predictions;
drop table if exists public.matches;
drop table if exists public.profiles;

-- 1. Profiles (Players)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  pin text not null, -- 4 digit passcode for friends to log in
  is_admin boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Matches Schedule
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  home_team text not null,
  away_team text not null,
  home_score integer, -- actual result (null if not played)
  away_score integer, -- actual result (null if not played)
  kickoff timestamp with time zone not null,
  status text default 'scheduled' not null, -- 'scheduled', 'live', 'completed'
  group_stage text default 'Group Stage' not null
);

-- 3. Predictions
create table public.predictions (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  home_prediction integer not null,
  away_prediction integer not null,
  points_awarded integer, -- null until match finishes and admin calculates
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (profile_id, match_id)
);

-- Enable RLS & set public policies for easy access
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Policies for Profiles
create policy "Allow all profiles read" on public.profiles for select using (true);
create policy "Allow insert profiles" on public.profiles for insert with check (true);

-- Policies for Matches
create policy "Allow all matches read" on public.matches for select using (true);
create policy "Allow admin match update" on public.matches for all using (true);

-- Policies for Predictions
create policy "Allow predictions read" on public.predictions for select using (true);
create policy "Allow user insert/update predictions" on public.predictions for all using (true);
