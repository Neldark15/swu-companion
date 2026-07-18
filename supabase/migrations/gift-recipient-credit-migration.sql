-- ═════════════════════════════════════════════════════════════════════
-- Cerrar el loop de regalos — Aplicada en producción 2026-07-18 vía MCP
--
-- Bug: el cliente (sender) intentaba actualizar player_stats del receptor,
-- pero la RLS "Update own stats" (auth.uid() = user_id) lo bloqueaba en
-- silencio (0 filas afectadas, sin error). Los 11 regalos históricos nunca
-- acreditaron XP/contadores/reputación al receptor.
--
-- Fix: triggers SECURITY DEFINER en gifts:
--   - BEFORE INSERT: valida no-self-gift + límite 5/día server-side
--   - AFTER INSERT: acredita al receptor (xp, gifts_received, contador por
--     tipo, social_reputation) — crea la fila de stats si no existe
-- + CHECK constraint sin auto-regalos
-- + Backfill de los 11 regalos históricos (verificado sin double-count:
--   SUM(gifts_received) era 0 antes del backfill)
-- + gifts agregada a la publicación Realtime (notificación en vivo)
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_gift_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  sent_today INT;
BEGIN
  IF NEW.sender_id = NEW.recipient_id THEN
    RAISE EXCEPTION 'No puedes enviarte regalos a ti mismo';
  END IF;

  SELECT COUNT(*) INTO sent_today
  FROM gifts
  WHERE sender_id = NEW.sender_id
    AND created_at >= date_trunc('day', now());

  IF sent_today >= 5 THEN
    RAISE EXCEPTION 'Límite diario de regalos alcanzado (5)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_validate ON public.gifts;
CREATE TRIGGER trg_gift_validate
  BEFORE INSERT ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public.validate_gift_insert();

CREATE OR REPLACE FUNCTION public.credit_gift_recipient()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE player_stats SET
    xp = COALESCE(xp, 0) + COALESCE(NEW.xp_amount, 0),
    gifts_received = COALESCE(gifts_received, 0) + 1,
    social_reputation = COALESCE(social_reputation, 0) + 1,
    lecciones_jedi_received = COALESCE(lecciones_jedi_received, 0)
      + CASE WHEN NEW.gift_type = 'leccion_jedi' THEN 1 ELSE 0 END,
    creditos_imperiales_received = COALESCE(creditos_imperiales_received, 0)
      + CASE WHEN NEW.gift_type = 'creditos_imperiales' THEN 1 ELSE 0 END,
    beskar_received = COALESCE(beskar_received, 0)
      + CASE WHEN NEW.gift_type = 'beskar' THEN 1 ELSE 0 END,
    holocron_received = COALESCE(holocron_received, 0)
      + CASE WHEN NEW.gift_type = 'holocron' THEN 1 ELSE 0 END,
    cristal_kyber_received = COALESCE(cristal_kyber_received, 0)
      + CASE WHEN NEW.gift_type = 'cristal_kyber' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE user_id = NEW.recipient_id;

  IF NOT FOUND THEN
    INSERT INTO player_stats (user_id, xp, gifts_received, social_reputation,
      lecciones_jedi_received, creditos_imperiales_received, beskar_received,
      holocron_received, cristal_kyber_received)
    VALUES (
      NEW.recipient_id,
      COALESCE(NEW.xp_amount, 0), 1, 1,
      CASE WHEN NEW.gift_type = 'leccion_jedi' THEN 1 ELSE 0 END,
      CASE WHEN NEW.gift_type = 'creditos_imperiales' THEN 1 ELSE 0 END,
      CASE WHEN NEW.gift_type = 'beskar' THEN 1 ELSE 0 END,
      CASE WHEN NEW.gift_type = 'holocron' THEN 1 ELSE 0 END,
      CASE WHEN NEW.gift_type = 'cristal_kyber' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_credit ON public.gifts;
CREATE TRIGGER trg_gift_credit
  AFTER INSERT ON public.gifts
  FOR EACH ROW EXECUTE FUNCTION public.credit_gift_recipient();

ALTER TABLE public.gifts DROP CONSTRAINT IF EXISTS gifts_no_self;
ALTER TABLE public.gifts ADD CONSTRAINT gifts_no_self CHECK (sender_id <> recipient_id);

-- Backfill histórico (una sola vez; ver verificación en el header)
UPDATE player_stats ps SET
  xp = COALESCE(ps.xp, 0) + agg.total_xp,
  gifts_received = COALESCE(ps.gifts_received, 0) + agg.cnt,
  social_reputation = COALESCE(ps.social_reputation, 0) + agg.cnt,
  lecciones_jedi_received = COALESCE(ps.lecciones_jedi_received, 0) + agg.leccion,
  creditos_imperiales_received = COALESCE(ps.creditos_imperiales_received, 0) + agg.creditos,
  beskar_received = COALESCE(ps.beskar_received, 0) + agg.beskar,
  holocron_received = COALESCE(ps.holocron_received, 0) + agg.holocron,
  cristal_kyber_received = COALESCE(ps.cristal_kyber_received, 0) + agg.kyber,
  updated_at = now()
FROM (
  SELECT recipient_id,
    SUM(COALESCE(xp_amount, 0)) AS total_xp,
    COUNT(*) AS cnt,
    COUNT(*) FILTER (WHERE gift_type = 'leccion_jedi') AS leccion,
    COUNT(*) FILTER (WHERE gift_type = 'creditos_imperiales') AS creditos,
    COUNT(*) FILTER (WHERE gift_type = 'beskar') AS beskar,
    COUNT(*) FILTER (WHERE gift_type = 'holocron') AS holocron,
    COUNT(*) FILTER (WHERE gift_type = 'cristal_kyber') AS kyber
  FROM gifts
  GROUP BY recipient_id
) agg
WHERE ps.user_id = agg.recipient_id;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE gifts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- Fix adicional descubierto al probar el trigger en producción:
-- coexistían DOS check constraints de gift_type — uno viejo con solo
-- 3 tipos (bloqueaba holocron y cristal_kyber, por eso tenían 0 envíos
-- históricos pese a estar en la UI) y el correcto con los 5.
-- También había dos constraints no-self-gift duplicados.
ALTER TABLE public.gifts DROP CONSTRAINT IF EXISTS gifts_gift_type_check;
ALTER TABLE public.gifts DROP CONSTRAINT IF EXISTS gifts_no_self; -- queda no_self_gift

-- Verificación E2E ejecutada en producción (2026-07-18):
--   INSERT holocron 10 XP → receptor +10 xp, +1 gifts_received,
--   +1 holocron_received, +1 social_reputation ✓ (revertido tras la prueba)
--   INSERT self-gift → EXCEPTION 'No puedes enviarte regalos a ti mismo' ✓
