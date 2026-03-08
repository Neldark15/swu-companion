-- Holocrón de Duelos — Match Logs Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS match_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  player1_profile_id UUID REFERENCES profiles(id),
  player2_profile_id UUID REFERENCES profiles(id),
  player1_deck_name TEXT,
  player2_deck_name TEXT,
  game_mode TEXT NOT NULL DEFAULT 'premier',
  winner_player INT NOT NULL,          -- 1 or 2
  game_results JSONB,                  -- [{winner:1},{winner:2},{winner:1}]
  final_score INT[] NOT NULL,          -- {2,1}
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_match_logs_user ON match_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_recorded ON match_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_logs_p1 ON match_logs(player1_profile_id);
CREATE INDEX IF NOT EXISTS idx_match_logs_p2 ON match_logs(player2_profile_id);

-- RLS
ALTER TABLE match_logs ENABLE ROW LEVEL SECURITY;

-- Users can manage their own logs
CREATE POLICY "Users manage own logs" ON match_logs
  FOR ALL USING (auth.uid() = user_id);

-- Public can read logs from public profiles
CREATE POLICY "Public read logs" ON match_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = match_logs.user_id
      AND profiles.is_public = true
    )
  );
