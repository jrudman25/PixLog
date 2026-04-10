-- PixLog Database Schema
-- Run this in Supabase SQL Editor to set up all tables and policies

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CREATE ALL TABLES FIRST (no cross-references in policies)
-- ============================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TIMELINES
CREATE TABLE IF NOT EXISTS public.timelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TIMELINE MEMBERS
CREATE TABLE IF NOT EXISTS public.timeline_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(timeline_id, user_id)
);

-- PHOTOS
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  original_filename TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed pagination
CREATE INDEX IF NOT EXISTS idx_photos_timeline_taken ON public.photos(timeline_id, taken_at DESC);

-- ============================================================
-- 2. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. POLICIES (all tables exist now, safe to cross-reference)
-- ============================================================

-- PROFILES policies
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- TIMELINES policies
CREATE POLICY "timelines_select_by_invite" ON public.timelines
  FOR SELECT USING (true);

CREATE POLICY "timelines_insert_auth" ON public.timelines
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "timelines_update_creator" ON public.timelines
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "timelines_delete_creator" ON public.timelines
  FOR DELETE USING (auth.uid() = created_by);

-- TIMELINE MEMBERS policies
CREATE POLICY "members_select_own_timelines" ON public.timeline_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.timeline_members AS m
      WHERE m.timeline_id = timeline_members.timeline_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert" ON public.timeline_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.timelines
      WHERE timelines.id = timeline_members.timeline_id
        AND timelines.created_by = auth.uid()
    )
  );

CREATE POLICY "members_delete_self_or_creator" ON public.timeline_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.timelines
      WHERE timelines.id = timeline_members.timeline_id
        AND timelines.created_by = auth.uid()
    )
  );

-- PHOTOS policies
CREATE POLICY "photos_select_members" ON public.photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_members.timeline_id = photos.timeline_id
        AND timeline_members.user_id = auth.uid()
    )
  );

CREATE POLICY "photos_insert_members" ON public.photos
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (
      SELECT 1 FROM public.timeline_members
      WHERE timeline_members.timeline_id = photos.timeline_id
        AND timeline_members.user_id = auth.uid()
    )
  );

CREATE POLICY "photos_update_uploader" ON public.photos
  FOR UPDATE USING (auth.uid() = uploaded_by);

CREATE POLICY "photos_delete_uploader_or_creator" ON public.photos
  FOR DELETE USING (
    auth.uid() = uploaded_by OR
    EXISTS (
      SELECT 1 FROM public.timelines
      WHERE timelines.id = photos.timeline_id
        AND timelines.created_by = auth.uid()
    )
  );

-- COMMENTS policies
CREATE POLICY "comments_select_members" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.photos
      JOIN public.timeline_members ON timeline_members.timeline_id = photos.timeline_id
      WHERE photos.id = comments.photo_id
        AND timeline_members.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_insert_members" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.photos
      JOIN public.timeline_members ON timeline_members.timeline_id = photos.timeline_id
      WHERE photos.id = comments.photo_id
        AND timeline_members.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_update_author" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "comments_delete_author" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. TRIGGER: Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', REPLACE(NEW.id::TEXT, '-', '')),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- ============================================================
-- 6. STORAGE (run separately if this errors)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);
