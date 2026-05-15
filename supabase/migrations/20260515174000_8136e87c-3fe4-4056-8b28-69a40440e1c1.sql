-- Replace gen_random_bytes (pgcrypto, not enabled) with gen_random_uuid (always available).
CREATE OR REPLACE FUNCTION public.get_or_create_playlist_share_token(p_playlist_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.playlists WHERE id = p_playlist_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Playlist not found';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT share_token INTO v_token FROM public.playlists WHERE id = p_playlist_id;
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- 12-char URL-safe token derived from a random UUID
  v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  UPDATE public.playlists SET share_token = v_token WHERE id = p_playlist_id;
  RETURN v_token;
END;
$$;