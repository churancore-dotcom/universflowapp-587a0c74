-- 1. Drop reactions and comments tables (feature removed)
DROP TABLE IF EXISTS public.song_reactions CASCADE;
DROP TABLE IF EXISTS public.song_comments CASCADE;

-- 2. Review reactions table (like/dislike on reviews)
CREATE TABLE IF NOT EXISTS public.review_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.app_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON public.review_reactions(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON public.review_reactions(user_id);

ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review reactions"
  ON public.review_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own reactions"
  ON public.review_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reactions"
  ON public.review_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON public.review_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.review_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;

-- 3. Allow users to change username freely.
--    Drop the old restrictive UPDATE policy and replace with one that
--    only protects is_admin (handled by trigger now).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Make sure is_admin can never be self-elevated (trigger-based safety)
DROP TRIGGER IF EXISTS profiles_prevent_admin_change ON public.profiles;
CREATE TRIGGER profiles_prevent_admin_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_field_change();

-- 4. Unique constraint for user artist prefs (so the same artist isn't double-saved)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_artist_preferences_user_artist_unique'
  ) THEN
    ALTER TABLE public.user_artist_preferences
      ADD CONSTRAINT user_artist_preferences_user_artist_unique
      UNIQUE (user_id, artist_name);
  END IF;
END $$;
