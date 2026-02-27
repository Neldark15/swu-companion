-- ═══════════════════════════════════════════════════════════════
-- SWU Companion — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '🎯',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Player Stats (gamification)
CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  matches_played INT DEFAULT 0,
  tournaments_created INT DEFAULT 0,
  tournaments_finished INT DEFAULT 0,
  decks_created INT DEFAULT 0,
  decks_valid INT DEFAULT 0,
  cards_collected INT DEFAULT 0,
  cards_favorited INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  login_days INT DEFAULT 1,
  last_login_date DATE DEFAULT CURRENT_DATE,
  modes_played TEXT[] DEFAULT '{}',
  unlocked_achievements TEXT[] DEFAULT ARRAY['vil_1'],
  achievement_dates JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT,
  is_active BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Decks
CREATE TABLE IF NOT EXISTS public.decks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  format TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Collection
CREATE TABLE IF NOT EXISTS public.collection (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INT DEFAULT 1,
  PRIMARY KEY (user_id, card_id)
);

-- 7. Favorite Cards
CREATE TABLE IF NOT EXISTS public.favorite_cards (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

-- 8. Monthly XP (Rank del Mes)
CREATE TABLE IF NOT EXISTS public.monthly_xp (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- '2026-02'
  xp_gained INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, month)
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_xp ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all (for leaderboard), but only edit own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Player Stats: same — viewable by all (leaderboard), editable by owner
CREATE POLICY "Stats are viewable by everyone" ON public.player_stats
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own stats" ON public.player_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.player_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Matches: private to owner
CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own matches" ON public.matches
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own matches" ON public.matches
  FOR DELETE USING (auth.uid() = user_id);

-- Tournaments: private to owner
CREATE POLICY "Users can view own tournaments" ON public.tournaments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tournaments" ON public.tournaments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tournaments" ON public.tournaments
  FOR DELETE USING (auth.uid() = user_id);

-- Decks: private to owner
CREATE POLICY "Users can view own decks" ON public.decks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own decks" ON public.decks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own decks" ON public.decks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own decks" ON public.decks
  FOR DELETE USING (auth.uid() = user_id);

-- Collection: private to owner
CREATE POLICY "Users can view own collection" ON public.collection
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own collection" ON public.collection
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collection" ON public.collection
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collection" ON public.collection
  FOR DELETE USING (auth.uid() = user_id);

-- Favorites: private to owner
CREATE POLICY "Users can view own favorites" ON public.favorite_cards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.favorite_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON public.favorite_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Monthly XP: viewable by all (leaderboard), editable by owner
CREATE POLICY "Monthly XP is viewable by everyone" ON public.monthly_xp
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own monthly xp" ON public.monthly_xp
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly xp" ON public.monthly_xp
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Jugador'),
    NEW.email
  );
  INSERT INTO public.player_stats (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- ADMIN / EVENTS SYSTEM (v2)
-- ═══════════════════════════════════════════════════════════════

-- Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 9. Official Events (created by admins, visible to all)
CREATE TABLE IF NOT EXISTS public.official_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'premier',
  match_type TEXT NOT NULL DEFAULT 'bo1',
  code TEXT UNIQUE NOT NULL,
  max_players INT NOT NULL DEFAULT 32,
  date TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','finished','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Event Registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.official_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered','checked_in','dropped')),
  registered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.official_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view official events
CREATE POLICY "events_select" ON public.official_events
  FOR SELECT TO authenticated USING (true);

-- Only admins can create events
CREATE POLICY "events_insert" ON public.official_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Organizer can update their own events
CREATE POLICY "events_update" ON public.official_events
  FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid());

-- Registrations: users see their own + organizers see their event's registrations
CREATE POLICY "reg_select" ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.official_events
      WHERE id = event_id AND organizer_id = auth.uid()
    )
  );

-- Users can register themselves
CREATE POLICY "reg_insert" ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can unregister themselves
CREATE POLICY "reg_delete" ON public.event_registrations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- NEWS SYSTEM (v3) — Admin-managed news feed
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'General',
  tag_color TEXT NOT NULL DEFAULT 'default',
  url TEXT,
  image_url TEXT,
  pinned BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Everyone (even non-authenticated) can read published news
CREATE POLICY "news_select" ON public.news
  FOR SELECT USING (published = true);

-- Only admins can create news
CREATE POLICY "news_insert" ON public.news
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update news
CREATE POLICY "news_update" ON public.news
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can delete news
CREATE POLICY "news_delete" ON public.news
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
