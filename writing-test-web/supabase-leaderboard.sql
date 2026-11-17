-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
create table if not exists public.writing_test_leaderboard (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 20),
  score int not null check (score between 0 and 100000),
  pct int not null check (pct between 0 and 100),
  grade text not null check (char_length(grade) <= 40),
  t bigint not null,
  created_at timestamptz not null default now()
);

alter table public.writing_test_leaderboard enable row level security;

-- Anyone can read the leaderboard and add a score; nobody can edit or delete.
create policy "read leaderboard" on public.writing_test_leaderboard
  for select to anon using (true);
create policy "add score" on public.writing_test_leaderboard
  for insert to anon with check (true);
