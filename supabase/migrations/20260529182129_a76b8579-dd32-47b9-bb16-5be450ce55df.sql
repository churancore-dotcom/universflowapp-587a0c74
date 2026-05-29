-- Restrict anon SELECT on app_reviews to non-sensitive columns only.
-- user_id links a review to a real account; only authenticated users (and admins) should see it.
REVOKE SELECT ON public.app_reviews FROM anon;
GRANT SELECT (id, display_name, rating, comment, created_at, updated_at) ON public.app_reviews TO anon;