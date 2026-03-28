-- Migration: Add user_devices and notification_preferences tables for iOS push notifications
-- Run this in your Supabase SQL editor

-- User devices table (stores APNs tokens)
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  apns_token text NOT NULL,
  live_activity_token text,
  platform text DEFAULT 'ios',
  app_version text,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, apns_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own devices" ON user_devices
  FOR ALL USING (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  prop_progress text DEFAULT 'every_event',
  score_updates text DEFAULT 'every_flip',
  parlay_legs boolean DEFAULT true,
  settlement boolean DEFAULT true,
  weekly_digest boolean DEFAULT true,
  tilt_alerts boolean DEFAULT true,
  strategy_adherence boolean DEFAULT false,
  milestones boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Add player_stats_snapshot column to tracked_bets if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracked_bets' AND column_name = 'player_stats_snapshot'
  ) THEN
    ALTER TABLE tracked_bets ADD COLUMN player_stats_snapshot jsonb;
  END IF;
END $$;
