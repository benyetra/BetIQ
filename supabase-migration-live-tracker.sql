-- BetIQ Live Bet Tracker - Schema Migration
-- Run this in the Supabase SQL Editor after the initial schema

-- ============================================================
-- NEW TABLE: tracked_bets
-- ============================================================

create table if not exists tracked_bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  bet_type text not null default 'straight',
  tracking_status text not null default 'live',
  legs jsonb default '[]',
  total_odds numeric not null default 1,
  stake numeric not null default 0,
  potential_payout numeric not null default 0,
  sportsbook text default '',
  presentation_theme text default 'dark',
  live_snapshot jsonb,
  created_at timestamptz default now(),
  settled_at timestamptz
);

-- ============================================================
-- NEW TABLE: tracked_bet_events (audit log)
-- ============================================================

create table if not exists tracked_bet_events (
  id uuid default gen_random_uuid() primary key,
  bet_id uuid references tracked_bets(id) on delete cascade not null,
  event_type text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_tracked_bets_user_id on tracked_bets(user_id);
create index if not exists idx_tracked_bets_status on tracked_bets(user_id, tracking_status);
create index if not exists idx_tracked_bet_events_bet_id on tracked_bet_events(bet_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table tracked_bets enable row level security;
alter table tracked_bet_events enable row level security;

create policy "Users can view own tracked bets" on tracked_bets
  for select using (auth.uid() = user_id);
create policy "Users can insert own tracked bets" on tracked_bets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tracked bets" on tracked_bets
  for update using (auth.uid() = user_id);
create policy "Users can delete own tracked bets" on tracked_bets
  for delete using (auth.uid() = user_id);

create policy "Users can view own tracked bet events" on tracked_bet_events
  for select using (
    exists (select 1 from tracked_bets where tracked_bets.id = tracked_bet_events.bet_id and tracked_bets.user_id = auth.uid())
  );
create policy "Users can insert own tracked bet events" on tracked_bet_events
  for insert with check (
    exists (select 1 from tracked_bets where tracked_bets.id = tracked_bet_events.bet_id and tracked_bets.user_id = auth.uid())
  );
