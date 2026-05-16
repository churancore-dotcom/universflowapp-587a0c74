-- email_verifications: explicit deny-all for client roles (service role bypasses RLS)
CREATE POLICY "Deny all client access to email_verifications"
ON public.email_verifications
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- api_rate_limits: allow users to read only their own row, deny writes from clients
CREATE POLICY "Users can view their own rate limits"
ON public.api_rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny client writes to api_rate_limits"
ON public.api_rate_limits
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny client updates to api_rate_limits"
ON public.api_rate_limits
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny client deletes to api_rate_limits"
ON public.api_rate_limits
AS RESTRICTIVE
FOR DELETE
TO anon, authenticated
USING (false);