-- ============================================================
-- SWU Companion — Módulo Espionaje: SQL para Supabase
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- 1) Nuevas columnas en player_stats (regalos)
-- ============================================================
ALTER TABLE player_stats
  ADD COLUMN IF NOT EXISTS gifts_received              integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gifts_sent                  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lecciones_jedi_received     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creditos_imperiales_received integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beskar_received             integer DEFAULT 0;

-- 2) Tabla de regalos
-- ============================================================
CREATE TABLE IF NOT EXISTS gifts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_type     text NOT NULL CHECK (gift_type IN ('leccion_jedi', 'creditos_imperiales', 'beskar')),
  xp_amount     integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),

  -- No auto-regalos
  CONSTRAINT no_self_gift CHECK (sender_id <> recipient_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_gifts_sender_date
  ON gifts (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gifts_recipient_date
  ON gifts (recipient_id, created_at DESC);

-- 3) RLS — Row Level Security
-- ============================================================
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- Cualquiera autenticado puede ver regalos (necesario para perfil público)
CREATE POLICY "gifts_select_authenticated"
  ON gifts FOR SELECT
  TO authenticated
  USING (true);

-- Solo puedes insertar regalos donde tú eres el sender
CREATE POLICY "gifts_insert_own"
  ON gifts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Nadie puede actualizar ni borrar regalos (son inmutables)
-- (No se crean policies de UPDATE/DELETE)

-- 4) FK para joins con profiles (si la tabla profiles existe)
-- ============================================================
-- Esto permite hacer .select('profiles!gifts_sender_id_fkey(name, avatar)')
-- Si ya tienes un trigger o tabla profiles vinculada a auth.users, estas FK
-- permiten el join automático de PostgREST/Supabase:

-- Solo ejecutar si tienes tabla "profiles" con columna "id" tipo uuid:
-- ALTER TABLE gifts
--   ADD CONSTRAINT gifts_sender_id_fkey
--     FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
--   ADD CONSTRAINT gifts_recipient_id_fkey
--     FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- LISTO. Después de ejecutar, verificar en Table Editor que:
-- ✅ player_stats tiene las 5 columnas nuevas
-- ✅ tabla gifts existe con RLS activado
-- ✅ Las policies aparecen en Authentication > Policies
-- ============================================================
