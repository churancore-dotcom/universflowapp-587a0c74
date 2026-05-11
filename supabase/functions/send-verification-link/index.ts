// Sends a branded "verify your email" link via Resend.
// Public endpoint — caller passes email + username; we cap at 1 email / 60s per address.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const APP_ORIGIN = 'https://universflow.in';
const FROM_ADDRESS = 'Universflow <noreply@universflow.in>';
const REPLY_TO = 'support@universflow.in';

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}
function isEmail(s: string): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}
async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const username = String(body?.username ?? '').trim().slice(0, 40) || 'there';

    if (!isEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the auth user (anti-abuse: must be a real user we just created)
    const lookup = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    if (!lookup.ok) {
      return new Response(JSON.stringify({ error: 'Lookup failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const lookupData = await lookup.json().catch(() => ({}));
    const u = (lookupData?.users ?? []).find((x: any) => String(x?.email ?? '').toLowerCase() === email);
    if (!u) {
      return new Response(JSON.stringify({ error: 'No account found for this email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = u.id as string;

    // Already verified?
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=email_verified`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    const prof = await profRes.json().catch(() => []);
    if (prof?.[0]?.email_verified) {
      return new Response(JSON.stringify({ success: true, already: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cooldown: 60s between sends
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?user_id=eq.${userId}&select=last_sent_at`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    const existing = await existingRes.json().catch(() => []);
    if (existing?.[0]?.last_sent_at) {
      const ageMs = Date.now() - new Date(existing[0].last_sent_at).getTime();
      if (ageMs < 60_000) {
        return new Response(JSON.stringify({
          error: `Please wait ${Math.ceil((60_000 - ageMs) / 1000)}s before requesting another email`,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Generate token (32 bytes hex = 64 chars), store SHA-256
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // Upsert verification row
    const upsert = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        email,
        code_hash: tokenHash,
        expires_at: expiresAt,
        attempts: 0,
        last_sent_at: new Date().toISOString(),
      }),
    });
    if (!upsert.ok) {
      const t = await upsert.text();
      console.error('upsert verification failed', upsert.status, t);
      return new Response(JSON.stringify({ error: 'Could not create verification' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verifyUrl = `${APP_ORIGIN}/verify?token=${token}`;
    const safeName = escape(username);

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="background:linear-gradient(180deg,#15151a 0%,#0a0a0b 100%);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.5)">
      <div style="padding:48px 32px 8px;text-align:center">
        <div style="font-size:30px;font-weight:700;letter-spacing:-0.6px;line-height:1">
          <span style="background:linear-gradient(135deg,#FF2D55,#BF5AF2,#5E5CE6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:#FF2D55">Univers</span><span style="color:#fff;font-weight:300;margin-left:4px">Flow</span>
        </div>
        <div style="margin-top:10px;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:#6e6e73">Premium Music Experience</div>
      </div>
      <div style="padding:32px 36px 8px;text-align:center">
        <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#FF2D55,#BF5AF2);line-height:64px;font-size:30px;margin-bottom:20px">✉️</div>
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;letter-spacing:-0.4px">Hey ${safeName},<br/>let's confirm it's you</h1>
        <p style="font-size:15px;line-height:1.6;color:#a1a1a6;margin:0 0 32px;max-width:420px;margin-left:auto;margin-right:auto">
          Tap the button below to verify your email and unlock millions of songs, curated playlists and a world of music.
        </p>
        <a href="${verifyUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#FF2D55,#BF5AF2);color:#fff;text-decoration:none;padding:16px 40px;border-radius:999px;font-weight:600;font-size:15px;letter-spacing:.01em;box-shadow:0 10px 30px rgba(255,45,85,0.35)">
          Confirm my email
        </a>
        <p style="margin:20px 0 0;font-size:12px;color:#6e6e73">This link works once and expires in 24 hours.</p>
      </div>
      <div style="margin:36px 36px 0;padding:18px 20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px">
        <p style="margin:0 0 6px;font-size:11px;color:#6e6e73;letter-spacing:.05em;text-transform:uppercase">Or paste this link</p>
        <a href="${verifyUrl}" style="color:#FF6B8A;text-decoration:none;font-size:12px;word-break:break-all">${verifyUrl}</a>
      </div>
      <div style="padding:32px 36px 36px;text-align:center">
        <p style="margin:0;font-size:11px;color:#48484a;line-height:1.6">
          Didn't sign up for Universflow? You can safely ignore this email — no account will be created.
        </p>
      </div>
    </div>
    <div style="text-align:center;margin-top:24px;font-size:11px;color:#48484a">
      © Universflow · <a href="https://universflow.in" style="color:#6e6e73;text-decoration:none">universflow.in</a>
    </div>
  </div>
</body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        reply_to: REPLY_TO,
        to: [email],
        subject: 'Confirm your Universflow email',
        html,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend failed', r.status, data);
      return new Response(JSON.stringify({ error: data?.message || 'Email send failed' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-verification-link error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
