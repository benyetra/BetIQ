-- BetIQ Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database

-- ============================================================
-- TABLES
-- ============================================================

-- Bets table (main data)
create table if not exists bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  bet_id text not null,
  sportsbook text not null,
  type text not null,
  status text not null,
  odds numeric not null,
  closing_line numeric,
  ev numeric,
  amount numeric not null,
  profit numeric not null,
  placed_at timestamptz not null,
  settled_at timestamptz,
  bet_info text default '',
  tags text default '',
  sports text[] default '{}',
  leagues text[] default '{}',
  legs jsonb default '[]',
  leg_count integer default 1,
  created_at timestamptz default now(),
  unique(user_id, bet_id)
);

-- Uploads table
create table if not exists uploads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  filename text not null,
  uploaded_at timestamptz not null,
  row_count integer not null default 0,
  status text not null default 'complete',
  created_at timestamptz default now()
);

-- Chat messages table
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null,
  content text not null,
  timestamp timestamptz not null,
  created_at timestamptz default now()
);

-- Strategies table
create table if not exists strategies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  sport_focus text[] default '{}',
  market_selection text[] default '{}',
  staking_plan text default '',
  rules text[] default '{}',
  goals text[] default '{}',
  active boolean default false,
  created_at timestamptz default now()
);

-- Insights table
create table if not exists insights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text not null,
  impact text default '',
  recommendation text default '',
  severity text not null default 'neutral',
  category text not null default 'general',
  data_points jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_bets_user_id on bets(user_id);
create index if not exists idx_bets_placed_at on bets(user_id, placed_at);
create index if not exists idx_uploads_user_id on uploads(user_id);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_strategies_user_id on strategies(user_id);
create index if not exists idx_insights_user_id on insights(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table bets enable row level security;
alter table uploads enable row level security;
alter table chat_messages enable row level security;
alter table strategies enable row level security;
alter table insights enable row level security;

-- Users can only access their own data
create policy "Users can view own bets" on bets
  for select using (auth.uid() = user_id);
create policy "Users can insert own bets" on bets
  for insert with check (auth.uid() = user_id);
create policy "Users can update own bets" on bets
  for update using (auth.uid() = user_id);
create policy "Users can delete own bets" on bets
  for delete using (auth.uid() = user_id);

create policy "Users can view own uploads" on uploads
  for select using (auth.uid() = user_id);
create policy "Users can insert own uploads" on uploads
  for insert with check (auth.uid() = user_id);

create policy "Users can view own chat messages" on chat_messages
  for select using (auth.uid() = user_id);
create policy "Users can insert own chat messages" on chat_messages
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own chat messages" on chat_messages
  for delete using (auth.uid() = user_id);

create policy "Users can view own strategies" on strategies
  for select using (auth.uid() = user_id);
create policy "Users can insert own strategies" on strategies
  for insert with check (auth.uid() = user_id);
create policy "Users can update own strategies" on strategies
  for update using (auth.uid() = user_id);
create policy "Users can delete own strategies" on strategies
  for delete using (auth.uid() = user_id);

create policy "Users can view own insights" on insights
  for select using (auth.uid() = user_id);
create policy "Users can insert own insights" on insights
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own insights" on insights
  for delete using (auth.uid() = user_id);
