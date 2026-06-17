-- Create table for newsletter subscribers
create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) to allow public inserts
alter table public.newsletter_subscribers enable row level security;

create policy "Enable insert for anonymous users" on public.newsletter_subscribers
  for insert with check (true);
