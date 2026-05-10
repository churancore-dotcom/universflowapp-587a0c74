import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function emailHtml(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff">
  <div style="max-width:520px;margin:0 auto;padding:48px 24px">
    <h1 style="font-size:28px;margin:0 0 8px;background:linear-gradient(135deg,#FF2D55,#BF5AF2,#5E5CE6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Universflow</h1>
    <p style="color:#a1a1aa;font-size:14px;margin:0 0 32px">Verify your email to start streaming.</p>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;text-align:center">
      <p style="color:#a1a1aa;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:2px">Your code</p>
      <p style="font-size:42px;letter-spacing:12px;font-weight:700;margin:0;color:#fff">${code}</p>
      <p style="color:#71717a;font-size:12px;margin:16px 0 0">Expires in 10 minutes</p>
    </div>
    <p style="color:#52525b;font-size:11px;margin-top:32px;text-align:center">If you didn't request this, ignore this email.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;
    const email = userData.user.email || '';
    if (!email) {
      return new Response(JSON.stringify({ error: 'No email on account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cooldown: 1 send per 30 seconds
    const { data: existing } = await admin
      .from('email_verifications')
      .select('last_sent_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing?.last_sent_at) {
      const elapsed = Date.now() - new Date(existing.last_sent_at).getTime();
      if (elapsed < 30_000) {
        return new Response(JSON.stringify({ error: `Please wait ${Math.ceil((30_000 - elapsed) / 1000)}s before requesting another code` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code + userId);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from('email_verifications')
      .upsert({ user_id: userId, email, code_hash, expires_at, attempts: 0, last_sent_at: new Date().toISOString() });
    if (upsertErr) throw upsertErr;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Universflow <onboarding@resend.dev>',
        to: [email],
        subject: `${code} is your Universflow verification code`,
        html: emailHtml(code),
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('Resend error', r.status, t);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
