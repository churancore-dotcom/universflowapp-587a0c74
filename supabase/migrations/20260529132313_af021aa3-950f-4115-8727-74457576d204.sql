
-- 1) Stop exposing app_reviews.user_id to clients (anon + authenticated).
--    Only safe public columns remain readable; service_role retains full access for admin tooling.
REVOKE SELECT ON public.app_reviews FROM anon, authenticated;
GRANT SELECT (id, created_at, updated_at, rating, comment, display_name) ON public.app_reviews TO anon, authenticated;
-- Keep authenticated writes scoped by existing RLS:
GRANT INSERT, UPDATE, DELETE ON public.app_reviews TO authenticated;

-- 2) Remove payment_requests from Realtime publication. It contains payer UPI / UTR / amount
--    and there is no need to broadcast row changes; admin UI can re-fetch on demand.
ALTER PUBLICATION supabase_realtime DROP TABLE public.payment_requests;

-- 3) Tighten realtime.messages. The previous policy granted SELECT to every authenticated
--    user with `true`, which would let any logged-in user subscribe to private broadcast/presence
--    topics. The app does not use private channels, so we drop the permissive policy entirely.
--    Postgres-changes subscriptions remain gated by RLS on the underlying source tables.
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
