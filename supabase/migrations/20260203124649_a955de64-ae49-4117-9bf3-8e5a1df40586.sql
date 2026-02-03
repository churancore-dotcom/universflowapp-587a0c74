-- 1. Create atomic promo code redemption function (fixes race condition)
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_code TEXT,
  p_user_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_promo_id UUID;
  v_existing_sub UUID;
BEGIN
  -- Single atomic operation with row-level locking
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses
    AND NOT EXISTS (
      SELECT 1 FROM code_redemptions
      WHERE user_id = p_user_id AND promo_code_id = promo_codes.id
    )
  RETURNING id INTO v_promo_id;
  
  IF v_promo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or already redeemed code');
  END IF;
  
  -- Insert redemption record
  INSERT INTO code_redemptions (user_id, promo_code_id)
  VALUES (p_user_id, v_promo_id);
  
  -- Check for existing subscription
  SELECT id INTO v_existing_sub FROM user_subscriptions WHERE user_id = p_user_id LIMIT 1;
  
  -- Grant premium (upsert)
  IF v_existing_sub IS NOT NULL THEN
    UPDATE user_subscriptions
    SET subscription_type = 'premium_yearly',
        status = 'active',
        expires_at = '2099-12-31T23:59:59Z',
        platform = 'web',
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO user_subscriptions (user_id, subscription_type, status, expires_at, platform)
    VALUES (p_user_id, 'premium_yearly', 'active', '2099-12-31T23:59:59Z', 'web');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION redeem_promo_code TO authenticated;

-- 2. Fix profiles RLS - Replace overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own full profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Users can view friend profiles (for dedications feature)
CREATE POLICY "Users can view friend profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friends
    WHERE status = 'accepted' AND (
      (friends.user_id = auth.uid() AND friends.friend_id = profiles.user_id) OR
      (friends.friend_id = auth.uid() AND friends.user_id = profiles.user_id)
    )
  )
);

-- 3. Create safe share code lookup function (for adding friends)
CREATE OR REPLACE FUNCTION find_profile_by_share_code(p_share_code TEXT)
RETURNS TABLE(user_id UUID, username TEXT, avatar_url TEXT) AS $$
BEGIN
  -- Only return non-sensitive fields (no email, no is_admin)
  RETURN QUERY
  SELECT p.user_id, p.username, p.avatar_url
  FROM profiles p
  WHERE p.share_code = p_share_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION find_profile_by_share_code TO authenticated;