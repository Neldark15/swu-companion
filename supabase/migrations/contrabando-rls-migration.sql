-- ═══════════════════════════════════════════════════════════
-- SWU Companion: Contrabando — Allow all authenticated users
-- to see ALL profiles (not just public ones)
-- Run in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- 0. Add updated_at column if missing (needed for ordering)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profiles_updated_at();

-- Backfill existing rows: set updated_at = created_at
UPDATE profiles SET updated_at = created_at WHERE updated_at IS NULL;

-- 1. Drop the restrictive profiles read policy
DO $$
BEGIN
  DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Create new policy: any authenticated user can see ALL profiles
--    (Contrabando shows everyone regardless of is_public)
CREATE POLICY "profiles_read_all_authenticated" ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Also allow anon/public to see basic profiles (for share links)
CREATE POLICY "profiles_read_public" ON profiles FOR SELECT
  USING (is_public = true);

-- 4. Update collection read policy to allow authenticated users
--    to see any user's collection (for Contrabando)
DO $$
BEGIN
  DROP POLICY IF EXISTS "collection_public_read" ON collection;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "collection_read_authenticated" ON collection FOR SELECT
  USING (auth.uid() IS NOT NULL);
