-- Restrict song_requests.audio_url and cover_url to Supabase storage URLs only
-- to prevent users from injecting attacker-controlled URLs via direct API calls.
ALTER TABLE public.song_requests
  ADD CONSTRAINT song_request_audio_url_storage
  CHECK (audio_url LIKE 'https://kzaeahjeqlihmxrfhjqd.supabase.co/storage/v1/%');

ALTER TABLE public.song_requests
  ADD CONSTRAINT song_request_cover_url_storage
  CHECK (cover_url IS NULL OR cover_url LIKE 'https://kzaeahjeqlihmxrfhjqd.supabase.co/storage/v1/%');
