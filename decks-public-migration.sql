-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Public Decks for Espionaje Module
-- ═══════════════════════════════════════════════════════════════
-- Problem: The decks table RLS only allows owners to SELECT their own decks.
--          The Espionaje (spy profile) feature needs to show public decks
--          of other players. The isPublic flag is stored inside the `data`
--          JSONB column as data->>'isPublic'.
--
-- Solution: Replace the SELECT policy so that:
--   - Owners can always see ALL their own decks (public + private)
--   - Any authenticated user can see decks where data->>'isPublic' = 'true'
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own decks" ON public.decks;

-- Step 2: Create new SELECT policy that allows:
--   a) Owners see all their decks
--   b) Any authenticated user can see public decks from anyone
CREATE POLICY "Users can view own decks or public decks" ON public.decks
  FOR SELECT USING (
    auth.uid() = user_id
    OR (data->>'isPublic')::boolean = true
  );

-- The INSERT, UPDATE, DELETE policies remain owner-only (no changes needed)
-- ═══════════════════════════════════════════════════════════════
-- DONE. After running this migration:
-- 1. Users can still see/edit/delete their own decks normally
-- 2. getPublicDecks() in the Espionaje module will now return results
-- 3. Private decks (isPublic=false) remain hidden from other users
-- ═══════════════════════════════════════════════════════════════
