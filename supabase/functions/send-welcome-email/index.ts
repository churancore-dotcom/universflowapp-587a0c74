// Sends a welcome / confirmation email via Resend after signup.
// Public endpoint (no JWT) — recipient + username are validated server-side.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

function isEmail(s: string): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
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

    const safeName = escape(username);
    const html = `<!doctype html><html><body style="margin:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#fff">
  <div style="max-width:560px;margin:0 auto;padding:48px 28px;text-align:center">
    <div style="font-size:28px;font-weight:600;letter-spacing:-0.5px">Universflow</div>
    <div style="margin-top:8px;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#777">Premium Music Experience</div>
    <h1 style="margin:32px 0 12px;font-size:22px;font-weight:600">Welcome, ${safeName} 🎧</h1>
    <p style="font-size:15px;line-height:1.55;color:#bbb;margin:0 0 28px">
      Your account is ready. Dive into millions of songs, follow your favourite artists,
      and discover what's trending right now around the world.
    </p>
    <a href="https://universflow.in/home"
       style="display:inline-block;background:#FF2D55;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px;letter-spacing:.02em">
      Open Universflow
    </a>
    <p style="margin:40px 0 0;font-size:11px;color:#555">If you didn't create this account, you can ignore this email.</p>
  </div>
</body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Universflow <onboarding@resend.dev>',
        to: [email],
        subject: '🎉 Welcome to Universflow',
        html,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(JSON.stringify({ error: data?.message || 'Resend failed', status: r.status }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, id: data?.id ?? null }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
