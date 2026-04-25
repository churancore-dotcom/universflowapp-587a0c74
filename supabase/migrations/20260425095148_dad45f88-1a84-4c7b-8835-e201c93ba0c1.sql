
-- 1) Lock down profile self-update to prevent privilege escalation via is_admin
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_admin = false);

-- Also attach the existing prevent_admin_field_change trigger as defense-in-depth
DROP TRIGGER IF EXISTS prevent_admin_field_change_trigger ON public.profiles;
CREATE TRIGGER prevent_admin_field_change_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_field_change();

-- 2) Enforce premium gating at the database layer for songs
DROP POLICY IF EXISTS "Anyone can view visible songs" ON public.songs;

CREATE POLICY "Users can view visible songs"
  ON public.songs
  FOR SELECT
  USING (
    is_visible = true
    AND (
      NOT is_premium_only
      OR (auth.uid() IS NOT NULL AND public.has_premium_subscription(auth.uid()))
    )
  );
