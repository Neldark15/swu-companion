-- ═══════════════════════════════════════════════════════════
-- SWU Companion: Public Collections + Card Prices Migration
-- ═══════════════════════════════════════════════════════════

-- 1. Profile public visibility + bio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON profiles(is_public);

-- 2. Card prices cache (shared across all users)
CREATE TABLE IF NOT EXISTS card_prices (
  card_id VARCHAR(255) PRIMARY KEY,
  market_price DECIMAL(10,2),
  low_price DECIMAL(10,2),
  high_price DECIMAL(10,2),
  source VARCHAR(50) DEFAULT 'swudb',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anyone to read prices
ALTER TABLE card_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_prices_public_read" ON card_prices FOR SELECT USING (true);
-- Allow authenticated users to insert/update prices (crowd-sourced)
CREATE POLICY "card_prices_auth_write" ON card_prices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "card_prices_auth_update" ON card_prices FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 3. Update RLS on collection to allow public reads
-- Drop existing policies first (if they exist)
DO $$
BEGIN
  DROP POLICY IF EXISTS "collection_user_select" ON collection;
  DROP POLICY IF EXISTS "collection_user_insert" ON collection;
  DROP POLICY IF EXISTS "collection_user_update" ON collection;
  DROP POLICY IF EXISTS "collection_user_delete" ON collection;
  DROP POLICY IF EXISTS "collection_public_read" ON collection;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Owner can do everything with their own collection
CREATE POLICY "collection_owner_all" ON collection FOR ALL
  USING (auth.uid() = user_id);

-- Public can read collection of users with is_public = true
CREATE POLICY "collection_public_read" ON collection FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = collection.user_id
      AND profiles.is_public = true
    )
  );

-- 4. Update RLS on profiles for public viewing
DO $$
BEGIN
  DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "profiles_public_read" ON profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

-- 5. Update RLS on favorite_cards for public viewing
DO $$
BEGIN
  DROP POLICY IF EXISTS "favorites_public_read" ON favorite_cards;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "favorites_public_read" ON favorite_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = favorite_cards.user_id
      AND profiles.is_public = true
    )
    OR auth.uid() = user_id
  );
