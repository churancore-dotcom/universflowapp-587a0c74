
-- Payment requests table
CREATE TABLE public.payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paise integer NOT NULL,
  utr_number text NOT NULL,
  payer_name text,
  payer_upi text,
  status text NOT NULL DEFAULT 'pending',
  plan text NOT NULL DEFAULT 'lifetime',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending','approved','rejected','auto_approved')),
  CONSTRAINT utr_min_length CHECK (char_length(utr_number) >= 6)
);

CREATE UNIQUE INDEX payment_requests_utr_unique ON public.payment_requests (lower(trim(utr_number)));
CREATE INDEX payment_requests_user_idx ON public.payment_requests (user_id, created_at DESC);
CREATE INDEX payment_requests_status_idx ON public.payment_requests (status, created_at DESC);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own payment request"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can view own payment requests"
  ON public.payment_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all payment requests"
  ON public.payment_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-grant premium when admin approves
CREATE OR REPLACE FUNCTION public.grant_premium_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('approved','auto_approved') AND OLD.status NOT IN ('approved','auto_approved') THEN
    INSERT INTO public.user_subscriptions (user_id, subscription_type, status, expires_at, platform)
    VALUES (NEW.user_id, 'premium_yearly', 'active', '2099-12-31T23:59:59Z', 'web')
    ON CONFLICT (user_id) DO UPDATE SET
      subscription_type = 'premium_yearly',
      status = 'active',
      expires_at = '2099-12-31T23:59:59Z',
      platform = 'web',
      updated_at = now();
    NEW.reviewed_at = COALESCE(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_requests_grant_premium
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.grant_premium_on_approval();

-- Default app_settings for UPI
INSERT INTO public.app_settings (key, value, description) VALUES
  ('premium_price_inr', '49'::jsonb, 'Premium plan price in INR (rupees, no paise)'),
  ('upi_id', '"yourupi@okaxis"'::jsonb, 'UPI VPA where premium payments are sent'),
  ('upi_payee_name', '"UniversFlow"'::jsonb, 'Name shown on the UPI app'),
  ('premium_enabled', 'true'::jsonb, 'Master switch for premium upgrade flow')
ON CONFLICT (key) DO NOTHING;
