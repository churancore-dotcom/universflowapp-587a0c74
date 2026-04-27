// Send FCM push notifications via Firebase Admin (HTTP v1 API)
// Uses Service Account JSON to mint a short-lived OAuth2 access token, then
// POSTs to https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendPushBody {
  title: string;
  body: string;
  deep_link?: string;        // e.g. "/song/abc" or "/playlist/xyz" or full https URL
  target_audience: "all" | "premium" | "free" | "specific";
  target_user_ids?: string[]; // when target_audience === 'specific'
  image_url?: string;
}

// ---- JWT signing for Google OAuth2 (service account) ----
function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const unsigned = `${headerB64}.${claimsB64}`;

  const keyBuf = pemToArrayBuffer(serviceAccount.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(sigBuf)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`OAuth token error: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tok = await tokenRes.json();
  return tok.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

    if (!FIREBASE_SERVICE_ACCOUNT) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    } catch {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT is not valid JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SendPushBody;
    if (!body.title || !body.body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target user IDs
    let userIds: string[] = [];
    if (body.target_audience === "specific" && body.target_user_ids?.length) {
      userIds = body.target_user_ids;
    } else if (body.target_audience === "all") {
      const { data } = await admin.from("profiles").select("user_id").limit(50000);
      userIds = (data ?? []).map((p) => p.user_id);
    } else if (body.target_audience === "premium") {
      const { data } = await admin
        .from("user_subscriptions")
        .select("user_id, status, subscription_type, expires_at")
        .eq("status", "active")
        .neq("subscription_type", "free");
      userIds = (data ?? [])
        .filter((s) => !s.expires_at || new Date(s.expires_at) > new Date())
        .map((s) => s.user_id);
    } else if (body.target_audience === "free") {
      const [{ data: allP }, { data: premP }] = await Promise.all([
        admin.from("profiles").select("user_id").limit(50000),
        admin.from("user_subscriptions").select("user_id").eq("status", "active").neq("subscription_type", "free"),
      ]);
      const premSet = new Set((premP ?? []).map((p) => p.user_id));
      userIds = (allP ?? []).map((p) => p.user_id).filter((id) => !premSet.has(id));
    }

    // Fetch device tokens for those users
    let tokens: string[] = [];
    if (userIds.length) {
      // chunk by 500 to stay under filter limits
      for (let i = 0; i < userIds.length; i += 500) {
        const chunk = userIds.slice(i, i + 500);
        const { data } = await admin
          .from("device_tokens")
          .select("token")
          .in("user_id", chunk);
        tokens.push(...(data ?? []).map((t) => t.token));
      }
    }

    if (tokens.length === 0) {
      // Still log to history
      await admin.from("push_history").insert({
        title: body.title,
        body: body.body,
        deep_link: body.deep_link ?? null,
        target_audience: body.target_audience,
        target_user_ids: body.target_audience === "specific" ? body.target_user_ids ?? null : null,
        sent_count: 0,
        success_count: 0,
        failure_count: 0,
        sent_by: uid,
      });
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No registered devices for audience" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id as string;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    // Send sequentially per token (FCM v1 has no batch endpoint; for small lists this is fine)
    // For very large lists we'd switch to multicast via legacy or chunked Promise.all.
    const concurrency = 20;
    for (let i = 0; i < tokens.length; i += concurrency) {
      const batch = tokens.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (token) => {
          try {
            const res = await fetch(fcmEndpoint, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: {
                    title: body.title,
                    body: body.body,
                    ...(body.image_url ? { image: body.image_url } : {}),
                  },
                  data: {
                    deep_link: body.deep_link ?? "/home",
                  },
                  android: {
                    priority: "HIGH",
                    notification: {
                      sound: "default",
                      channel_id: "universflow_default",
                    },
                  },
                },
              }),
            });
            if (res.ok) return { ok: true as const, token };
            const txt = await res.text();
            // 404 / UNREGISTERED / INVALID_ARGUMENT means stale token
            if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(txt)) {
              return { ok: false as const, token, invalid: true };
            }
            console.error("FCM send error", res.status, txt);
            return { ok: false as const, token, invalid: false };
          } catch (e) {
            console.error("FCM fetch threw", e);
            return { ok: false as const, token, invalid: false };
          }
        }),
      );
      for (const r of results) {
        if (r.ok) successCount++;
        else {
          failureCount++;
          if (r.invalid) invalidTokens.push(r.token);
        }
      }
    }

    // Cleanup invalid tokens
    if (invalidTokens.length) {
      await admin.from("device_tokens").delete().in("token", invalidTokens);
    }

    await admin.from("push_history").insert({
      title: body.title,
      body: body.body,
      deep_link: body.deep_link ?? null,
      target_audience: body.target_audience,
      target_user_ids: body.target_audience === "specific" ? body.target_user_ids ?? null : null,
      sent_count: tokens.length,
      success_count: successCount,
      failure_count: failureCount,
      sent_by: uid,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: tokens.length,
        success_count: successCount,
        failure_count: failureCount,
        invalid_removed: invalidTokens.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("send-push fatal", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
