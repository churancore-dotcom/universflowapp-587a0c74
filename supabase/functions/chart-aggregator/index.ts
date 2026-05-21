// Chart aggregator: pulls trending, viral, and latest from free public sources
// Sources: iTunes/Apple Music RSS, Last.fm, YouTube Data API, Deezer
// No API keys required except LASTFM_API_KEY + YOUTUBE_API_KEY (already in secrets)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LASTFM_KEY = Deno.env.get("LASTFM_API_KEY") ?? "";
const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? "";

// Countries to aggregate (ISO-2). GLOBAL is special (worldwide).
const COUNTRIES = ["GLOBAL", "US", "IN", "GB", "BR", "DE", "FR", "JP", "KR", "MX", "ID", "CA", "AU", "IT", "ES", "NL", "AE", "SA", "TR", "PH"];

// iTunes RSS country codes are lowercase, e.g. "us", "in"
const itunesCountry = (cc: string) => (cc === "GLOBAL" ? "us" : cc.toLowerCase());

type Row = {
  chart_type: "trending" | "viral" | "latest";
  country_code: string;
  rank: number;
  title: string;
  artist: string;
  cover_url?: string | null;
  source: string;
  external_id?: string | null;
};

const fetchJson = async (url: string, timeoutMs = 8000): Promise<any | null> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Universflow/1.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

// --- iTunes / Apple Music Most-Played (TRENDING) ---
async function fetchAppleMostPlayed(cc: string): Promise<Row[]> {
  const country = itunesCountry(cc);
  const url = `https://rss.applemarketingtools.com/api/v2/${country}/music/most-played/50/songs.json`;
  const data = await fetchJson(url);
  const results = data?.feed?.results ?? [];
  return results.map((it: any, i: number) => ({
    chart_type: "trending" as const,
    country_code: cc,
    rank: i + 1,
    title: it.name,
    artist: it.artistName,
    cover_url: it.artworkUrl100?.replace("100x100", "500x500") ?? null,
    source: "apple",
    external_id: it.id,
  }));
}

// --- iTunes RSS New Releases (LATEST) ---
async function fetchItunesNewReleases(cc: string): Promise<Row[]> {
  const country = itunesCountry(cc);
  const url = `https://itunes.apple.com/${country}/rss/newreleases/limit=50/json`;
  const data = await fetchJson(url);
  const entries = data?.feed?.entry ?? [];
  return entries.map((it: any, i: number) => ({
    chart_type: "latest" as const,
    country_code: cc,
    rank: i + 1,
    title: it["im:name"]?.label ?? "",
    artist: it["im:artist"]?.label ?? "",
    cover_url: it["im:image"]?.slice(-1)?.[0]?.label?.replace(/\d+x\d+/, "500x500") ?? null,
    source: "itunes",
    external_id: it.id?.attributes?.["im:id"] ?? null,
  })).filter((r: Row) => r.title && r.artist);
}

// --- Last.fm (VIRAL/trending globally + per country) ---
async function fetchLastFm(cc: string): Promise<Row[]> {
  if (!LASTFM_KEY) return [];
  const url = cc === "GLOBAL"
    ? `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${LASTFM_KEY}&format=json&limit=50`
    : `https://ws.audioscrobbler.com/2.0/?method=geo.gettoptracks&country=${countryNameFromCode(cc)}&api_key=${LASTFM_KEY}&format=json&limit=50`;
  const data = await fetchJson(url);
  const tracks = data?.tracks?.track ?? data?.toptracks?.track ?? [];
  return tracks.map((t: any, i: number) => ({
    chart_type: "viral" as const,
    country_code: cc,
    rank: i + 1,
    title: t.name,
    artist: typeof t.artist === "string" ? t.artist : t.artist?.name ?? "",
    cover_url: t.image?.slice(-1)?.[0]?.["#text"] || null,
    source: "lastfm",
    external_id: t.mbid || null,
  })).filter((r: Row) => r.title && r.artist);
}

// --- YouTube Trending Music (TRENDING fallback per region) ---
async function fetchYouTubeTrending(cc: string): Promise<Row[]> {
  if (!YT_KEY || cc === "GLOBAL") return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=${cc}&maxResults=50&key=${YT_KEY}`;
  const data = await fetchJson(url);
  const items = data?.items ?? [];
  return items.map((it: any, i: number) => {
    const sn = it.snippet ?? {};
    // Try to split "Artist - Title" patterns
    const raw = (sn.title ?? "").replace(/\(.*?official.*?\)/gi, "").trim();
    let title = raw, artist = sn.channelTitle ?? "";
    const dash = raw.split(/\s[-–]\s/);
    if (dash.length >= 2) {
      artist = dash[0].trim();
      title = dash.slice(1).join(" - ").trim();
    }
    return {
      chart_type: "trending" as const,
      country_code: cc,
      rank: i + 1 + 100, // de-rank under Apple
      title,
      artist,
      cover_url: sn.thumbnails?.maxres?.url ?? sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? null,
      source: "youtube",
      external_id: it.id,
    };
  }).filter((r: Row) => r.title && r.artist);
}

// --- Deezer Global Chart (VIRAL fallback when Last.fm misses) ---
async function fetchDeezerChart(cc: string): Promise<Row[]> {
  if (cc !== "GLOBAL") return [];
  const url = `https://api.deezer.com/chart/0/tracks?limit=50`;
  const data = await fetchJson(url);
  const tracks = data?.data ?? [];
  return tracks.map((t: any, i: number) => ({
    chart_type: "viral" as const,
    country_code: "GLOBAL",
    rank: i + 1 + 100,
    title: t.title,
    artist: t.artist?.name ?? "",
    cover_url: t.album?.cover_xl ?? t.album?.cover_big ?? null,
    source: "deezer",
    external_id: String(t.id),
  })).filter((r: Row) => r.title && r.artist);
}

function countryNameFromCode(cc: string): string {
  const map: Record<string, string> = {
    US: "United States", IN: "India", GB: "United Kingdom", BR: "Brazil",
    DE: "Germany", FR: "France", JP: "Japan", KR: "South Korea",
    MX: "Mexico", ID: "Indonesia", CA: "Canada", AU: "Australia",
    IT: "Italy", ES: "Spain", NL: "Netherlands", AE: "United Arab Emirates",
    SA: "Saudi Arabia", TR: "Turkey", PH: "Philippines",
  };
  return map[cc] ?? "United States";
}

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function isAdminCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const jwt = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: claims } = await userClient.auth.getClaims(jwt).catch(() => ({ data: null as any }));
  const uid = claims?.claims?.sub;
  if (!uid) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (error) return false;
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Authorize: matching CRON_SECRET header (scheduler) OR admin JWT (manual trigger).
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const cronOk = CRON_SECRET.length > 0 && safeEqual(cronHeader, CRON_SECRET);
  if (!cronOk) {
    const adminOk = await isAdminCaller(req);
    if (!adminOk) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  // Optional: ?country=IN to refresh a single country, otherwise all
  const url = new URL(req.url);
  const onlyCountry = url.searchParams.get("country");
  const targets = onlyCountry ? [onlyCountry.toUpperCase()] : COUNTRIES;

  let totalInserted = 0;
  const summary: Record<string, number> = {};

  for (const cc of targets) {
    const [apple, itunes, lastfm, yt, deezer] = await Promise.all([
      fetchAppleMostPlayed(cc),
      fetchItunesNewReleases(cc),
      fetchLastFm(cc),
      fetchYouTubeTrending(cc),
      fetchDeezerChart(cc),
    ]);

    const rows: Row[] = [...apple, ...itunes, ...lastfm, ...yt, ...deezer];
    if (rows.length === 0) {
      summary[cc] = 0;
      continue;
    }

    // Wipe + replace per country (atomic-ish)
    await supabase.from("chart_tracks").delete().eq("country_code", cc);

    // Insert in batches of 500
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("chart_tracks").insert(batch);
      if (error) console.error(`[${cc}] insert error:`, error.message);
      else totalInserted += batch.length;
    }
    summary[cc] = rows.length;
  }

  const tookMs = Date.now() - startedAt;
  return new Response(
    JSON.stringify({ ok: true, totalInserted, tookMs, summary }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
