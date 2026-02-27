-- ═══════════════════════════════════════════════════
-- Tower Defense: Defensa de la Base Estelar
-- Migration SQL — run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Game scores table (one row per game played)
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  game_number INTEGER NOT NULL,
  wave_reached INTEGER NOT NULL,
  score INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_scores_user_date ON game_scores(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_date ON game_scores(date);

-- RLS
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_scores_select" ON game_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "game_scores_insert" ON game_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Done!
-- After running this, the Tower Defense game will be able to save scores.
