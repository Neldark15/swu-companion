-- ═════════════════════════════════════════════════════════════════════
-- Web Push subscriptions table — Fase C
-- Aplicada en producción 2026-05-22 vía MCP apply_migration
-- ═════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,           -- key.p256dh
  auth TEXT NOT NULL,             -- key.auth
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  failure_count INT DEFAULT 0     -- bumped when push fails; >5 → cleanup candidate
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- RLS: users own their subscriptions. Service role bypasses RLS automatically.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own_select" ON push_subscriptions;
CREATE POLICY "push_subs_own_select" ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_own_insert" ON push_subscriptions;
CREATE POLICY "push_subs_own_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_own_update" ON push_subscriptions;
CREATE POLICY "push_subs_own_update" ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_own_delete" ON push_subscriptions;
CREATE POLICY "push_subs_own_delete" ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
