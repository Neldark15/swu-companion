-- ═════════════════════════════════════════════════════════════════════
-- Audit Logs — registro de acciones admin
-- Aplicar en Supabase SQL Editor (una vez)
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,           -- 'role.change', 'user.delete', 'news.create', 'event.cancel', 'push.send', etc.
  target_type TEXT,               -- 'user', 'event', 'news', 'card', etc.
  target_id TEXT,                 -- id del objetivo (opcional)
  metadata JSONB DEFAULT '{}',    -- contexto extra (before/after, payload, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

-- RLS: solo admins pueden leer/escribir
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Lectura: admins only
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Escritura: admins only (la app inserta desde el cliente con auth.uid del admin)
DROP POLICY IF EXISTS "audit_logs_admin_write" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_write" ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Permisos
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
