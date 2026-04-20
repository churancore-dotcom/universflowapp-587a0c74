ALTER TABLE public.playlist_songs DROP CONSTRAINT IF EXISTS playlist_songs_song_id_fkey;
ALTER TABLE public.user_library DROP CONSTRAINT IF EXISTS user_library_song_id_fkey;
ALTER TABLE public.recently_played DROP CONSTRAINT IF EXISTS recently_played_song_id_fkey;
ALTER TABLE public.song_comments DROP CONSTRAINT IF EXISTS song_comments_song_id_fkey;
ALTER TABLE public.song_reactions DROP CONSTRAINT IF EXISTS song_reactions_song_id_fkey;

ALTER TABLE public.playlist_songs
  ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.playlist_songs
  ADD COLUMN IF NOT EXISTS track_source text NOT NULL DEFAULT 'library';
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_track
  ON public.playlist_songs (playlist_id, song_id);

ALTER TABLE public.user_library
  ALTER COLUMN song_id TYPE text USING song_id::text;
ALTER TABLE public.user_library
  ADD COLUMN IF NOT EXISTS track_source text NOT NULL DEFAULT 'library';
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_library_user_track
  ON public.user_library (user_id, song_id);

CREATE TABLE IF NOT EXISTS public.stream_songs (
  track_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'indexed',
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  cover_url text,
  audio_url text,
  duration integer,
  artist_image_url text,
  genre text,
  mood text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.stream_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view stream songs" ON public.stream_songs;
CREATE POLICY "Anyone can view stream songs"
ON public.stream_songs
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can cache stream songs" ON public.stream_songs;
CREATE POLICY "Authenticated users can cache stream songs"
ON public.stream_songs
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can refresh stream songs" ON public.stream_songs;
CREATE POLICY "Authenticated users can refresh stream songs"
ON public.stream_songs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage stream songs" ON public.stream_songs;
CREATE POLICY "Admins can manage stream songs"
ON public.stream_songs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_stream_songs_source
  ON public.stream_songs (source);
CREATE INDEX IF NOT EXISTS idx_stream_songs_artist_title
  ON public.stream_songs (artist, title);

DROP TRIGGER IF EXISTS update_stream_songs_updated_at ON public.stream_songs;
CREATE TRIGGER update_stream_songs_updated_at
BEFORE UPDATE ON public.stream_songs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();