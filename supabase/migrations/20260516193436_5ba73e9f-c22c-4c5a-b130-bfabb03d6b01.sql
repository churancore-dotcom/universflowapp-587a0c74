-- Remove sensitive tables from realtime publication (anyone authenticated could subscribe to topics)
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime DROP TABLE public.announcement_events;

-- Prevent anonymous user_id enumeration via public app_reviews
REVOKE SELECT (user_id) ON public.app_reviews FROM anon;