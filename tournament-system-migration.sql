-- ═══════════════════════════════════════════════════
-- SISTEMA DE TORNEOS — Migration SQL
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Columnas nuevas en official_events
ALTER TABLE official_events
  ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'swiss'
    CHECK (tournament_type IN ('swiss','elimination')),
  ADD COLUMN IF NOT EXISTS max_rounds INT,
  ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_timer_minutes INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS round_timer_end TIMESTAMPTZ;

-- 2. Tabla de rondas
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES official_events(id) ON DELETE CASCADE NOT NULL,
  round_number INT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(event_id, round_number)
);

-- 3. Tabla de emparejamientos
CREATE TABLE IF NOT EXISTS tournament_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES tournament_rounds(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES official_events(id) ON DELETE CASCADE NOT NULL,
  table_number INT,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  winner_id UUID,
  score TEXT,
  reported_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de standings
CREATE TABLE IF NOT EXISTS tournament_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES official_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  player_name TEXT,
  points INT DEFAULT 0,
  match_wins INT DEFAULT 0,
  match_losses INT DEFAULT 0,
  match_draws INT DEFAULT 0,
  game_wins INT DEFAULT 0,
  game_losses INT DEFAULT 0,
  byes INT DEFAULT 0,
  omw_pct NUMERIC(5,2) DEFAULT 0,
  gw_pct NUMERIC(5,2) DEFAULT 0,
  dropped BOOLEAN DEFAULT FALSE,
  seed INT,
  UNIQUE(event_id, user_id)
);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_rounds_event ON tournament_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_pairings_event ON tournament_pairings(event_id);
CREATE INDEX IF NOT EXISTS idx_pairings_round ON tournament_pairings(round_id);
CREATE INDEX IF NOT EXISTS idx_standings_event ON tournament_standings(event_id);

-- 6. RLS
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_standings ENABLE ROW LEVEL SECURITY;

-- SELECT público (para vista sin auth)
CREATE POLICY "rounds_public_select" ON tournament_rounds FOR SELECT USING (true);
CREATE POLICY "pairings_public_select" ON tournament_pairings FOR SELECT USING (true);
CREATE POLICY "standings_public_select" ON tournament_standings FOR SELECT USING (true);

-- INSERT para admin
CREATE POLICY "rounds_admin_insert" ON tournament_rounds FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "rounds_admin_update" ON tournament_rounds FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "pairings_admin_insert" ON tournament_pairings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pairings_admin_update" ON tournament_pairings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pairings_admin_delete" ON tournament_pairings FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "standings_admin_insert" ON tournament_standings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "standings_admin_update" ON tournament_standings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Participantes pueden reportar resultado de SU pairing
CREATE POLICY "pairings_participant_update" ON tournament_pairings FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- 7. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_pairings;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_standings;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_rounds;
