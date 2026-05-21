// Telegram notification for premium events
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Restrict CORS to known first-party origins. Telegram bot calls cost nothing
// per request but spam our admin chat; wildcard let any site trigger that.
const ALLOWED_ORIGINS = new Set([
  'https://universflow.in',
  'https://www.universflow.in',
  'https://universflowapp.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'capacitor://localhost',
  'https://localhost',
]);
function buildCors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.has(o) ? o : 'https://universflow.in';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}


interface NotifyBody {
  event: 'payment_submitted' | 'premium_granted' | 'promo_redeemed' | 'payment_rejected';
  email?: string;
  user_id?: string;
  plan?: string;
  amount_inr?: number;
  utr?: string;
  note?: string;
}

const ADMIN_ONLY_EVENTS = new Set(['premium_granted', 'payment_rejected']);

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });


  try {
    // ── Auth check: every caller must be a signed-in user ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;
    const callerEmail = userData.user.email ?? null;

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
    if (!token || !chatId) {
      return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as NotifyBody;

    // Admin-only events: verify admin role server-side
    if (ADMIN_ONLY_EVENTS.has(body.event)) {
      const { data: isAdmin } = await supabaseClient.rpc('has_role', {
        _user_id: callerId,
        _role: 'admin',
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin role required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // User events: ignore client-supplied email/user_id, force the authenticated identity
      body.email = callerEmail ?? body.email;
      body.user_id = callerId;

      // Per-user rate limit: max 5 notifications per minute
      const { data: allowed } = await supabaseClient.rpc('check_and_increment_rate_limit', {
        _user_id: callerId,
        _endpoint: 'telegram-notify',
        _max_per_minute: 5,
      });
      if (allowed === false) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For payment_submitted: require a matching payment_requests row owned by caller
      // to prevent flooding admin Telegram with fabricated payment notifications.
      if (body.event === 'payment_submitted') {
        if (!body.utr || typeof body.utr !== 'string') {
          return new Response(JSON.stringify({ error: 'UTR required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: pr, error: prErr } = await supabaseClient
          .from('payment_requests')
          .select('id, amount_paise, plan')
          .eq('user_id', callerId)
          .eq('utr_number', body.utr.trim())
          .maybeSingle();
        if (prErr || !pr) {
          return new Response(JSON.stringify({ error: 'No matching payment request' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Use server-side values; ignore client-supplied amount/plan
        body.amount_inr = Math.round((pr.amount_paise ?? 0) / 100);
        body.plan = pr.plan ?? body.plan;
      }

      // Cap free-text fields to prevent abuse
      if (body.note && typeof body.note === 'string') body.note = body.note.slice(0, 200);
      if (body.utr && typeof body.utr === 'string') body.utr = body.utr.slice(0, 50);
      if (body.plan && typeof body.plan === 'string') body.plan = body.plan.slice(0, 40);
    }

    const emoji: Record<string, string> = {
      payment_submitted: '💸',
      premium_granted: '👑',
      promo_redeemed: '🎟️',
      payment_rejected: '❌',
    };
    const title: Record<string, string> = {
      payment_submitted: 'New Payment Submitted',
      premium_granted: 'Premium Activated',
      promo_redeemed: 'Promo Code Redeemed',
      payment_rejected: 'Payment Rejected',
    };

    const lines = [
      `${emoji[body.event] ?? 'ℹ️'} <b>${title[body.event] ?? body.event}</b>`,
      body.email ? `👤 ${body.email}` : null,
      body.plan ? `📦 Plan: <b>${body.plan}</b>` : null,
      typeof body.amount_inr === 'number' ? `💰 ₹${body.amount_inr}` : null,
      body.utr ? `🧾 UTR: <code>${body.utr}</code>` : null,
      body.note ? `📝 ${body.note}` : null,
      body.user_id ? `🆔 <code>${body.user_id}</code>` : null,
      `🕐 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].filter(Boolean);

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok) {
      console.error('Telegram error', tgData);
      return new Response(JSON.stringify({ error: tgData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
