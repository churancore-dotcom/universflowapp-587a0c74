-- Add username_changed field to profiles to track one-time username change
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username_changed boolean NOT NULL DEFAULT false;

-- Add realtime for more tables that admin needs
ALTER PUBLICATION supabase_realtime ADD TABLE public.artists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_library;