-- ═════════════════════════════════════════════════════════════════════
-- Hub de comunidad + feed auto-generado
-- Aplicada en producción 2026-07-18 vía MCP apply_migration
--
--   1. metadata jsonb para posts auto-generados (icono, podio, precio…)
--   2. post_likes real (identidad + sin duplicados) reemplaza el contador
--      falsificable; trigger mantiene community_posts.likes denormalizado
--   3. RPC toggle_post_like atómico
--   4. Cierra un agujero de seguridad: la policy UPDATE era USING(true),
--      o sea cualquiera podía editar CUALQUIER campo de CUALQUIER post
--   5. Realtime sobre community_posts
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts (country_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;
CREATE POLICY "post_likes_read" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_likes_own_insert" ON public.post_likes;
CREATE POLICY "post_likes_own_insert" ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_likes_own_delete" ON public.post_likes;
CREATE POLICY "post_likes_own_delete" ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes = COALESCE(likes, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSE
    UPDATE community_posts SET likes = GREATEST(0, COALESCE(likes, 0) - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_like_count ON public.post_likes;
CREATE TRIGGER trg_post_like_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID)
RETURNS TABLE (liked BOOLEAN, like_count INT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  uid UUID := auth.uid();
  existing BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Se requiere sesión para reaccionar';
  END IF;

  SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_id = uid)
    INTO existing;

  IF existing THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_id = uid;
  ELSE
    INSERT INTO post_likes (post_id, user_id) VALUES (p_post_id, uid)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN QUERY
    SELECT (NOT existing) AS liked,
           COALESCE((SELECT likes FROM community_posts WHERE id = p_post_id), 0)::INT AS like_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID) TO authenticated;

DROP POLICY IF EXISTS "Auth users can update likes" ON public.community_posts;

DROP POLICY IF EXISTS "posts_author_update" ON public.community_posts;
CREATE POLICY "posts_author_update" ON public.community_posts FOR UPDATE
  USING (auth.uid() = user_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
