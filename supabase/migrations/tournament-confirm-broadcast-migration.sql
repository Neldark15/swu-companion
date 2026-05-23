-- ═════════════════════════════════════════════════════════════════════
-- Tournament: confirmation flow + global broadcasts
-- Aplicar en Supabase SQL Editor (o vía MCP apply_migration)
-- Aplicada en producción el 2026-05-22
-- ═════════════════════════════════════════════════════════════════════

-- 1. Columnas para flujo report → confirm → resolved (o dispute)
ALTER TABLE tournament_pairings
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disputed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;

-- 2. Feed global de torneos (para no-participantes)
CREATE TABLE IF NOT EXISTS tournament_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES official_events(id) ON DELETE CASCADE,
  event_name TEXT,
  event_code TEXT,
  type TEXT NOT NULL,         -- 'pairing_set' | 'result_confirmed' | 'round_complete' | 'tournament_finished'
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON tournament_broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_event ON tournament_broadcasts(event_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_type ON tournament_broadcasts(type);

-- 3. RLS — lectura pública (para notificar a no-participantes), insert auth
ALTER TABLE tournament_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcasts_public_read" ON tournament_broadcasts;
CREATE POLICY "broadcasts_public_read" ON tournament_broadcasts FOR SELECT USING (true);

DROP POLICY IF EXISTS "broadcasts_auth_insert" ON tournament_broadcasts;
CREATE POLICY "broadcasts_auth_insert" ON tournament_broadcasts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Habilitar Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tournament_broadcasts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
