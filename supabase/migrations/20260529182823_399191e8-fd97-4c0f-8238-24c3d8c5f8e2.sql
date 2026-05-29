-- Default prices (idempotent; do not overwrite if admin already customised them)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('premium_price_monthly_inr',   to_jsonb(59),  'Premium 1-month price in INR'),
  ('premium_price_bimonthly_inr', to_jsonb(100), 'Premium 2-month price in INR'),
  ('premium_price_quarterly_inr', to_jsonb(149), 'Premium 3-month price in INR')
ON CONFLICT (key) DO NOTHING;

-- Add bimonthly (60-day) handling to the auto-grant trigger
CREATE OR REPLACE FUNCTION public.grant_premium_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expires timestamptz;
  v_type public.subscription_type;
  v_base timestamptz;
BEGIN
  IF current_setting('request.skip_payment_grant', true) = '1' THEN
    NEW.reviewed_at = COALESCE(NEW.reviewed_at, now());
    RETURN NEW;
  END IF;

  IF NEW.status IN ('approved','auto_approved')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT GREATEST(now(), COALESCE(us.expires_at, now()))
      INTO v_base
      FROM public.user_subscriptions us
      WHERE us.user_id = NEW.user_id
      LIMIT 1;
    v_base := COALESCE(v_base, now());

    IF NEW.plan = 'lifetime' THEN
      v_expires := '2099-12-31 23:59:59+00'::timestamptz;
      v_type := 'premium_yearly'::public.subscription_type;
    ELSIF NEW.plan = 'quarterly' THEN
      v_expires := v_base + interval '90 days';
      v_type := 'premium_yearly'::public.subscription_type;
    ELSIF NEW.plan = 'bimonthly' THEN
      v_expires := v_base + interval '60 days';
      v_type := 'premium_monthly'::public.subscription_type;
    ELSE
      v_expires := v_base + interval '30 days';
      v_type := 'premium_monthly'::public.subscription_type;
    END IF;

    INSERT INTO public.user_subscriptions (user_id, subscription_type, status, expires_at, platform)
    VALUES (NEW.user_id, v_type, 'active', v_expires, 'web')
    ON CONFLICT (user_id) DO UPDATE SET
      subscription_type = EXCLUDED.subscription_type,
      status = 'active',
      expires_at = GREATEST(public.user_subscriptions.expires_at, EXCLUDED.expires_at),
      platform = 'web',
      updated_at = now();

    NEW.reviewed_at = COALESCE(NEW.reviewed_at, now());
  END IF;

  RETURN NEW;
END;
$function$;

-- And to the admin review RPC
CREATE OR REPLACE FUNCTION public.admin_review_payment_request(p_request_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_req public.payment_requests%ROWTYPE;
  v_expires timestamptz;
  v_type public.subscription_type;
  v_base timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  SELECT * INTO v_req FROM public.payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;

  PERFORM set_config('request.skip_payment_grant', '1', true);

  UPDATE public.payment_requests
  SET status = p_status, reviewed_at = COALESCE(reviewed_at, now()), updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  IF p_status = 'approved' THEN
    SELECT GREATEST(now(), COALESCE(us.expires_at, now()))
      INTO v_base FROM public.user_subscriptions us WHERE us.user_id = v_req.user_id LIMIT 1;
    v_base := COALESCE(v_base, now());

    IF v_req.plan = 'lifetime' THEN
      v_expires := '2099-12-31 23:59:59+00'::timestamptz;
      v_type := 'premium_yearly'::public.subscription_type;
    ELSIF v_req.plan = 'quarterly' THEN
      v_expires := v_base + interval '90 days';
      v_type := 'premium_yearly'::public.subscription_type;
    ELSIF v_req.plan = 'bimonthly' THEN
      v_expires := v_base + interval '60 days';
      v_type := 'premium_monthly'::public.subscription_type;
    ELSE
      v_expires := v_base + interval '30 days';
      v_type := 'premium_monthly'::public.subscription_type;
    END IF;

    INSERT INTO public.user_subscriptions (user_id, subscription_type, status, expires_at, platform)
    VALUES (v_req.user_id, v_type, 'active', v_expires, 'web')
    ON CONFLICT (user_id) DO UPDATE SET
      subscription_type = EXCLUDED.subscription_type,
      status = 'active',
      expires_at = GREATEST(public.user_subscriptions.expires_at, EXCLUDED.expires_at),
      platform = 'web',
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status, 'user_id', v_req.user_id);
END;
$function$;