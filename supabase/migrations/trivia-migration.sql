-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Trivia "Archivos Jedi"
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla de progreso diario de trivia
CREATE TABLE IF NOT EXISTS public.trivia_progress (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  questions_answered INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  answered_ids TEXT[] DEFAULT '{}',
  PRIMARY KEY (user_id, date)
);

-- 2. RLS para trivia_progress
ALTER TABLE public.trivia_progress ENABLE ROW LEVEL SECURITY;

-- Usuarios solo ven su propio progreso
CREATE POLICY "trivia_select" ON public.trivia_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Usuarios solo insertan su propio progreso
CREATE POLICY "trivia_insert" ON public.trivia_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuarios solo actualizan su propio progreso
CREATE POLICY "trivia_update" ON public.trivia_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- NOTA: El XP de trivia NO afecta el ranking del Consejo.
-- El Consejo solo muestra ranking por torneos/partidas.
-- El XP de trivia se acumula solo en el Holocrón (perfil).
-- ═══════════════════════════════════════════════════════════════
