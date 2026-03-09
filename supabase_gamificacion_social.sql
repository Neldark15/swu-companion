-- ============================================================
-- SWU Companion — Gamificación Social: SQL Completo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─── 1. ALTER player_stats: Nuevas columnas ─────────────────

ALTER TABLE player_stats
  ADD COLUMN IF NOT EXISTS holocron_received       INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cristal_kyber_received   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_missions_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_missions_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_reputation        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_title             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS unlocked_titles          TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mission_streak           INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_mission_streak      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relationship_count       INT DEFAULT 0;

-- ─── 2. ALTER gifts: Ampliar CHECK para 5 tipos + effective_xp ──

-- Drop old constraint if it exists (named or unnamed)
DO $$
BEGIN
  -- Try to drop by common name patterns
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'gifts' AND constraint_type = 'CHECK'
  ) THEN
    -- Drop all check constraints on gifts table related to gift_type
    EXECUTE (
      SELECT string_agg('ALTER TABLE gifts DROP CONSTRAINT ' || constraint_name, '; ')
      FROM information_schema.table_constraints
      WHERE table_name = 'gifts' AND constraint_type = 'CHECK'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if no constraints
END $$;

-- Add updated CHECK with 5 gift types
ALTER TABLE gifts
  ADD CONSTRAINT gifts_type_check
    CHECK (gift_type IN ('leccion_jedi', 'creditos_imperiales', 'beskar', 'holocron', 'cristal_kyber'));

-- Add effective_xp and diminished columns
ALTER TABLE gifts
  ADD COLUMN IF NOT EXISTS effective_xp INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diminished   BOOLEAN DEFAULT FALSE;

-- ─── 3. CREATE TABLE user_missions ──────────────────────────

CREATE TABLE IF NOT EXISTS user_missions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id      TEXT NOT NULL,
  mission_type    TEXT NOT NULL CHECK (mission_type IN ('daily', 'weekly')),
  period_key      TEXT NOT NULL,          -- '2026-03-08' for daily, '2026-W10' for weekly
  progress        INT DEFAULT 0,
  completed       BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  claimed         BOOLEAN DEFAULT FALSE,
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates: one mission per user per period
  UNIQUE (user_id, mission_id, period_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_missions_user_period
  ON user_missions (user_id, period_key);
CREATE INDEX IF NOT EXISTS idx_user_missions_user_type
  ON user_missions (user_id, mission_type, period_key);

-- RLS
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own missions"
  ON user_missions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
  ON user_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions"
  ON user_missions FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 4. CREATE TABLE user_relationships ─────────────────────

CREATE TABLE IF NOT EXISTS user_relationships (
  user_id_a           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points              INT DEFAULT 0,
  level               INT DEFAULT 0 CHECK (level >= 0 AND level <= 4),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  -- user_id_a must always be < user_id_b (canonical ordering)
  PRIMARY KEY (user_id_a, user_id_b),
  CHECK (user_id_a < user_id_b)
);

-- Indexes for looking up relationships by either user
CREATE INDEX IF NOT EXISTS idx_relationships_user_a
  ON user_relationships (user_id_a, points DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_user_b
  ON user_relationships (user_id_b, points DESC);

-- RLS
ALTER TABLE user_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own relationships"
  ON user_relationships FOR SELECT
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

CREATE POLICY "Users can insert own relationships"
  ON user_relationships FOR INSERT
  WITH CHECK (auth.uid() = user_id_a OR auth.uid() = user_id_b);

CREATE POLICY "Users can update own relationships"
  ON user_relationships FOR UPDATE
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

-- ─── 5. Índice adicional en gifts para diminishing returns ──

CREATE INDEX IF NOT EXISTS idx_gifts_pair_recent
  ON gifts (sender_id, recipient_id, created_at DESC);

-- ============================================================
-- FIN — Ejecutar todo de una vez en Supabase SQL Editor
-- ============================================================
