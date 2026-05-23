-- ═══════════════════════════════════════════════════════════════
-- FIX: Política RLS para UPDATE de official_events
-- El problema: solo el organizer_id podía actualizar eventos,
-- pero admin también necesita poder hacerlo.
--
-- EJECUTAR EN: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- Eliminar la política actual de UPDATE
DROP POLICY IF EXISTS "events_update" ON public.official_events;

-- Crear nueva política que permite al organizador O admin actualizar
CREATE POLICY "events_update" ON public.official_events
  FOR UPDATE TO authenticated
  USING (
    organizer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Verificar que la política de DELETE también incluya admin (ya debería estar)
-- DROP POLICY IF EXISTS "events_delete" ON public.official_events;
-- CREATE POLICY "events_delete" ON public.official_events
--   FOR DELETE TO authenticated
--   USING (
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
--   );
