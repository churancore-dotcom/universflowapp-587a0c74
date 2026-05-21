import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

// Restrict CORS to known first-party origins. Wildcard `*` allowed any site to
// pull this endpoint with a victim user's bearer token from their browser.
const ALLOWED_ORIGINS = new Set([
  'https://universflow.in',
  'https://www.universflow.in',
  'https://universflowapp.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'capacitor://localhost',
  'https://localhost',
]);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://universflow.in';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Backend auth is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Missing authorization token.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ad-hoc per-user rate limit (60 req/min — generous; protects DB from
    // abusive auto-retry loops in the landing page review widget).
    const { data: allowed } = await adminClient.rpc('check_and_increment_rate_limit', {
      _user_id: user.id,
      _endpoint: 'verify-registered-user',
      _max_per_minute: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ success: false, error: 'Too many requests. Try again in a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('user_id, status, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const accountStatus = profile?.status || 'active';
    const emailVerified = Boolean(user.email_confirmed_at);
    const reviewEligible = Boolean(profile?.user_id) && emailVerified && accountStatus === 'active';

    return new Response(JSON.stringify({
      success: true,
      reviewEligible,
      user: {
        id: user.id,
        email: user.email,
        emailVerified,
        registered: Boolean(profile?.user_id),
        status: accountStatus,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected verification error.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
