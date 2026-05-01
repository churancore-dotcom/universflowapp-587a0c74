// System-side push notifications (no admin auth required).
// Called by DB triggers via pg_net to notify users about premium activation,
// expiry warnings, and expirations. Reuses FCM HTTP v1.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SystemPushBody {
  user_ids: string[];
  title: string;
  body: string;
  deep_link?: string;
  // Shared secret to prevent unauthorized invocation from public clients.
  system_token?: string;
}

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = input;
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function parseServiceAccount(raw: string): FirebaseServiceAccount {
  const trimmed = raw.trim().replace(/^\uFEFF/, "");
  const parsed = JSON.parse(trimmed);
  return {
    project_id: parsed.project_id,
    client_email: parsed.client_email,
    private_key: String(parsed.private_key).replace(/\\n/g, "\n"),
  };
}

async function getAccessToken(sa: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    const SYSTEM_TOKEN = Deno.env.get("SYSTEM_PUSH_TOKEN") ?? SERVICE_ROLE;

    if (!FIREBASE_SA) {
      return new Response(JSON.stringify({ error: "FCM not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as SystemPushBody;

    // Auth: either service-role bearer (DB / admin invoke) or matching system_token
    const auth = req.headers.get("Authorization") ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    const isAuthorized = bearer === SERVICE_ROLE || body.system_token === SYSTEM_TOKEN;
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!body.user_ids?.length || !body.title || !body.body) {
      return new Response(JSON.stringify({ error: "user_ids, title, body required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: tokenRows } = await admin
      .from("device_tokens")
      .select("token")
      .in("user_id", body.user_ids);
    const tokens = (tokenRows ?? []).map((r) => r.token);

    if (tokens.length === 0) {
      await admin.from("push_history").insert({
        title: body.title, body: body.body,
        deep_link: body.deep_link ?? null,
        target_audience: "specific",
        target_user_ids: body.user_ids,
        sent_count: 0, success_count: 0, failure_count: 0,
      });
      return new Response(JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sa = parseServiceAccount(FIREBASE_SA);
    const accessToken = await getAccessToken(sa);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let success = 0, failure = 0;
    const invalid: string[] = [];

    for (let i = 0; i < tokens.length; i += 20) {
      const batch = tokens.slice(i, i + 20);
      const results = await Promise.all(batch.map(async (token) => {
        try {
          const res = await fetch(fcmEndpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: body.title, body: body.body },
                data: { deep_link: body.deep_link ?? "/premium" },
                android: {
                  priority: "HIGH",
                  notification: { sound: "default", channel_id: "universflow_default" },
                },
              },
            }),
          });
          if (res.ok) return { ok: true as const, token };
          const txt = await res.text();
          if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(txt)) {
            return { ok: false as const, token, invalid: true };
          }
          return { ok: false as const, token, invalid: false };
        } catch {
          return { ok: false as const, token, invalid: false };
        }
      }));
      for (const r of results) {
        if (r.ok) success++; else { failure++; if (r.invalid) invalid.push(r.token); }
      }
    }

    if (invalid.length) {
      await admin.from("device_tokens").delete().in("token", invalid);
    }

    await admin.from("push_history").insert({
      title: body.title, body: body.body,
      deep_link: body.deep_link ?? null,
      target_audience: "specific",
      target_user_ids: body.user_ids,
      sent_count: tokens.length,
      success_count: success,
      failure_count: failure,
    });

    return new Response(JSON.stringify({ success: true, sent: tokens.length, success_count: success, failure_count: failure }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-system-push error", msg);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
