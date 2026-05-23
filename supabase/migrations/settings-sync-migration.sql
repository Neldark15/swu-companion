-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Agregar columna settings a profiles + tablas faltantes
-- Ejecutar en: Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna settings a profiles (para sync de configuración)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2. Crear tabla collection si no existe
CREATE TABLE IF NOT EXISTS collection (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- 3. Crear tabla favorite_cards si no existe
CREATE TABLE IF NOT EXISTS favorite_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- 4. RLS para collection
ALTER TABLE collection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own collection" ON collection;
CREATE POLICY "Users can view own collection" ON collection
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own collection" ON collection;
CREATE POLICY "Users can insert own collection" ON collection
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own collection" ON collection;
CREATE POLICY "Users can update own collection" ON collection
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own collection" ON collection;
CREATE POLICY "Users can delete own collection" ON collection
  FOR DELETE USING (auth.uid() = user_id);

-- 5. RLS para favorite_cards
ALTER TABLE favorite_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON favorite_cards;
CREATE POLICY "Users can view own favorites" ON favorite_cards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own favorites" ON favorite_cards;
CREATE POLICY "Users can insert own favorites" ON favorite_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own favorites" ON favorite_cards;
CREATE POLICY "Users can delete own favorites" ON favorite_cards
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_collection_user ON collection(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_cards_user ON favorite_cards(user_id);

-- 7. Verificar que la tabla matches exista para sync futuro
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own matches" ON matches;
CREATE POLICY "Users can manage own matches" ON matches
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_matches_user ON matches(user_id);

SELECT 'Migración completada exitosamente' AS resultado;
