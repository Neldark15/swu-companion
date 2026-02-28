-- ═══════════════════════════════════════════════════
-- Tournament Results Migration
-- Sistema de ranking mixto (posición + bonus por victorias)
-- ═══════════════════════════════════════════════════

-- Tabla de resultados de torneo para ranking
CREATE TABLE IF NOT EXISTS tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_name TEXT NOT NULL,
  position INT NOT NULL,
  total_players INT NOT NULL,
  ranking_points INT NOT NULL DEFAULT 0,
  match_wins INT DEFAULT 0,
  match_draws INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_tournament_results_user_id ON tournament_results(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_results_played_at ON tournament_results(played_at);

-- RLS: usuarios pueden ver todos, solo insertar para su propio user_id
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer (para ranking público)
CREATE POLICY "tournament_results_select_public" ON tournament_results
  FOR SELECT USING (true);

-- Solo pueden insertar registros propios (o servicio)
CREATE POLICY "tournament_results_insert_own" ON tournament_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sistema de puntos (referencia):
-- Posición 1: 10 puntos
-- Posición 2: 7 puntos
-- Posición 3: 5 puntos
-- Posición 4: 3 puntos
-- Resto: 1 punto (participación)
-- Bonus: +3 por victoria, +1 por empate
-- Total = posición + bonus
