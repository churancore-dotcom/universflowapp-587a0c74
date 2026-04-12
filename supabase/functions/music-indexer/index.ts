import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY') || '9560c1d6069ed833e8104e1ef8ee9e95';
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// ── Instance lists (pruned to actually-working ones, April 2026) ──

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://pipedapi.leptons.xyz',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.thepixora.com',
  'https://invidious.jing.rocks',
  'https://iv.nboez.cc',
  'https://invidious.slipfox.xyz',
];

// ── Dynamic instance discovery (cached 30 min) ──

let dynamicPiped: string[] = [];
let dynamicInvidious: string[] = [];
let instancesFetchedAt = 0;

async function refreshInstances() {
  if (Date.now() - instancesFetchedAt < 30 * 60 * 1000) return;
  instancesFetchedAt = Date.now();
  try {
    const data = await fetchJson('https://piped-instances.kavin.rocks/', 5000);
    if (Array.isArray(data)) {
      dynamicPiped = data
        .filter((d: any) => d.api_url && !d.api_url.includes('.onion'))
        .map((d: any) => d.api_url.replace(/\/$/, ''));
    }
  } catch { /* keep stale list */ }
  try {
    const data = await fetchJson('https://api.invidious.io/instances.json?sort_by=api,health', 5000);
    if (Array.isArray(data)) {
      dynamicInvidious = data
        .filter(([, info]: any) => info?.api && info?.type === 'https')
        .slice(0, 10)
        .map(([, info]: any) => info.uri.replace(/\/$/, ''));
    }
  } catch { /* keep stale list */ }
}

function getPipedInstances(): string[] {
  const all = [...new Set([...dynamicPiped, ...PIPED_INSTANCES])];
  // deprioritize recently-failed
  return all.sort((a, b) => (failedUntil.get(a) || 0) - (failedUntil.get(b) || 0));
}

function getInvidiousInstances(): string[] {
  const all = [...new Set([...dynamicInvidious, ...INVIDIOUS_INSTANCES])];
  return all.sort((a, b) => (failedUntil.get(a) || 0) - (failedUntil.get(b) || 0));
}

// ── Health tracking: skip instances that failed recently ──

const failedUntil = new Map<string, number>(); // instance → timestamp

function markFailed(instance: string) {
  failedUntil.set(instance, Date.now() + 2 * 60 * 1000); // skip for 2 min
}
function isHealthy(instance: string): boolean {
  const until = failedUntil.get(instance);
  if (!until) return true;
  if (Date.now() > until) { failedUntil.delete(instance); return true; }
  return false;
}

// ── Types ──

type LastFmTrack = {
  name?: string;
  artist?: string | { name?: string };
  listeners?: string;
  duration?: string;
  album?: { title?: string; image?: Array<{ '#text'?: string }> };
  image?: Array<{ '#text'?: string }>;
  url?: string;
  '@attr'?: { rank?: string };
};

type IndexedTrack = {
  id: string; title: string; artist: string;
  album?: string; cover_url?: string; duration?: number;
  listeners?: number; rank?: number;
};

type ResolveResult = {
  success: boolean; streamUrl?: string; videoId?: string;
  duration?: number; title?: string; artist?: string; error?: string; fallback?: boolean;
};

const LASTFM_PLACEHOLDER_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

// ── Caching ──

const cache = new Map<string, { expiresAt: number; value: unknown }>();
function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) { cache.delete(key); return null; }
  return hit.value as T;
}
function setCached(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ── Helpers ──

function normalizeText(v: string) {
  return v.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function makeTrackId(artist: string, title: string) {
  return `lfm-${normalizeText(artist).replace(/\s+/g, '-')}-${normalizeText(title).replace(/\s+/g, '-')}`;
}
function getArtistName(a: LastFmTrack['artist']) { return typeof a === 'string' ? a : a?.name || 'Unknown Artist'; }
function getExtralargeImage(images?: Array<{ '#text'?: string }>) { return images?.[3]?.['#text'] || ''; }
function sanitizeArtwork(url?: string) {
  if (!url) return undefined;
  if (url.includes(LASTFM_PLACEHOLDER_HASH)) return undefined;
  return url;
}

function upscaleItunesArtwork(url?: string) {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.');
}

function scoreMetadataCandidate(item: Record<string, unknown>, artist: string, title: string) {
  const itemArtist = normalizeText(String(item.artistName || ''));
  const itemTitle = normalizeText(String(item.trackName || ''));
  const wantedArtist = normalizeText(artist);
  const wantedTitle = normalizeText(title);
  let score = 0;
  if (wantedArtist && itemArtist.includes(wantedArtist)) score += 8;
  if (wantedTitle && itemTitle.includes(wantedTitle)) score += 10;
  score += wantedTitle.split(' ').filter((word) => word.length > 2 && itemTitle.includes(word)).length;
  return score;
}

async function getItunesArtwork(artist: string, title: string): Promise<string | undefined> {
  const cacheKey = `itunes-art:${artist}:${title}`;
  const cached = getCached<string | null>(cacheKey);
  if (cached !== null) return cached || undefined;

  try {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', `${artist} ${title}`);
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '5');

    const data = await fetchJson(url.toString(), 5000);
    const results = Array.isArray(data?.results) ? data.results : [];
    const best = results
      .map((item: Record<string, unknown>) => ({ item, score: scoreMetadataCandidate(item, artist, title) }))
      .sort((a, b) => b.score - a.score)[0]?.item;

    const artwork = sanitizeArtwork(upscaleItunesArtwork(String(best?.artworkUrl100 || '')));
    setCached(cacheKey, artwork || null, 12 * 60 * 60 * 1000);
    return artwork;
  } catch {
    setCached(cacheKey, null, 30 * 60 * 1000);
    return undefined;
  }
}

async function fetchJson(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'UniversFlow/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function buildLastFmUrl(method: string, params: Record<string, string>) {
  const url = new URL(LASTFM_BASE_URL);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', LASTFM_API_KEY);
  url.searchParams.set('format', 'json');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

// ── Last.fm ──

async function getTrackInfo(artist: string, track: string): Promise<LastFmTrack | null> {
  const ck = `info:${artist}:${track}`;
  const c = getCached<LastFmTrack | null>(ck);
  if (c !== null) return c;
  try {
    const d = await fetchJson(buildLastFmUrl('track.getInfo', { artist, track, autocorrect: '1' }));
    const r = (d?.track || null) as LastFmTrack | null;
    setCached(ck, r, 15 * 60 * 1000);
    return r;
  } catch { setCached(ck, null, 2 * 60 * 1000); return null; }
}

function mapTrack(base: LastFmTrack, info?: LastFmTrack | null): IndexedTrack | null {
  const title = info?.name || base?.name || '';
  const artist = getArtistName(info?.artist || base?.artist);
  if (!title || !artist) return null;
  const cover_url = sanitizeArtwork(
    getExtralargeImage(info?.album?.image) ||
    getExtralargeImage(info?.image) ||
    getExtralargeImage(base?.image) ||
    getExtralargeImage(base?.album?.image) ||
    undefined
  );
  const rawD = info?.duration || base?.duration;
  const duration = rawD ? Math.round(Number(rawD) / (Number(rawD) > 1000 ? 1000 : 1)) : undefined;
  return {
    id: makeTrackId(artist, title), title, artist,
    album: info?.album?.title || base?.album?.title,
    cover_url, duration,
    listeners: Number(info?.listeners || base?.listeners || 0) || undefined,
    rank: Number(base?.['@attr']?.rank || 0) || undefined,
  };
}

async function hydrateTrackArtwork(track: IndexedTrack): Promise<IndexedTrack> {
  if (track.cover_url) return track;
  const artwork = await getItunesArtwork(track.artist, track.title);
  return artwork ? { ...track, cover_url: artwork } : track;
}

function uniqueTracks(tracks: Array<IndexedTrack | null>) {
  const seen = new Set<string>();
  return tracks.filter((t): t is IndexedTrack => {
    if (!t) return false;
    const k = `${normalizeText(t.artist)}::${normalizeText(t.title)}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

async function searchLastFm(query: string, limit = 24) {
  const ck = `search:${query}:${limit}`;
  const c = getCached<IndexedTrack[]>(ck);
  if (c) return c;
  const d = await fetchJson(buildLastFmUrl('track.search', { track: query, limit: String(limit) }));
  const raw = d?.results?.trackmatches?.track;
  const matches: LastFmTrack[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const enriched = await Promise.all(matches.slice(0, limit).map(async (t) => {
    const info = t.name ? await getTrackInfo(getArtistName(t.artist), t.name) : null;
    const mapped = mapTrack(t, info);
    return mapped ? hydrateTrackArtwork(mapped) : null;
  }));
  const results = uniqueTracks(enriched);
  setCached(ck, results, 5 * 60 * 1000);
  return results;
}

async function getTopTracks(limit = 20) {
  const ck = `top:${limit}`;
  const c = getCached<IndexedTrack[]>(ck);
  if (c) return c;
  const d = await fetchJson(buildLastFmUrl('chart.gettoptracks', { limit: String(limit) }));
  const raw = d?.tracks?.track;
  const tracks: LastFmTrack[] = Array.isArray(raw) ? raw : [];
  const enriched = await Promise.all(tracks.slice(0, limit).map(async (t) => {
    const info = t.name ? await getTrackInfo(getArtistName(t.artist), t.name) : null;
    const mapped = mapTrack(t, info);
    return mapped ? hydrateTrackArtwork(mapped) : null;
  }));
  const results = uniqueTracks(enriched).slice(0, limit);
  setCached(ck, results, 15 * 60 * 1000);
  return results;
}

// ── Video search & scoring ──

function scoreVideo(item: Record<string, unknown>, artist: string, title: string) {
  const iTitle = normalizeText(String(item.title || ''));
  const iArtist = normalizeText(String(item.author || item.uploaderName || item.uploader || ''));
  const wArtist = normalizeText(artist);
  const wTitle = normalizeText(title);
  const dur = Number(item.lengthSeconds || item.duration || 0);
  let s = 0;
  if (wTitle && iTitle.includes(wTitle)) s += 12;
  if (wArtist && iTitle.includes(wArtist)) s += 4;
  if (wArtist && iArtist.includes(wArtist)) s += 8;
  s += wTitle.split(' ').filter(w => w.length > 2 && iTitle.includes(w)).length * 1.5;
  ['karaoke','sped up','slowed','reverb','8d audio','nightcore','live','cover','remix','instrumental']
    .forEach(t => { if (iTitle.includes(t) && !wTitle.includes(t)) s -= 5; });
  if (dur >= 60 && dur <= 900) s += 2; else s -= 2;
  return s;
}

function extractVideoId(c: unknown) {
  if (typeof c !== 'string') return undefined;
  const d = c.match(/^[a-zA-Z0-9_-]{11}$/);
  if (d) return d[0];
  const w = c.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return w?.[1];
}

// ── Search: parallel race across healthy instances ──

async function searchForCandidates(artist: string, title: string): Promise<Record<string, unknown>[]> {
  const query = `${artist} ${title} audio`;
  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const addCandidate = (item: Record<string, unknown>) => {
    const vid = String(item.videoId || '');
    if (!vid || seen.has(vid)) return;
    seen.add(vid);
    candidates.push(item);
  };

  // Try Piped first (generally more reliable)
  const pipedInstances = getPipedInstances().filter(isHealthy).slice(0, 4);
  const pipedResults = await Promise.allSettled(
    pipedInstances.map(async (inst) => {
      try {
        const data = await fetchJson(`${inst}/search?q=${encodeURIComponent(query)}&filter=videos`, 6000);
        const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        return items.map((item: any) => ({
          ...item,
          videoId: item.videoId || extractVideoId(item.url),
          _source: inst,
        }));
      } catch (e) {
        markFailed(inst);
        throw e;
      }
    })
  );

  for (const r of pipedResults) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      const ranked = r.value
        .map((item: any) => ({ item, score: scoreVideo({ title: item.title, author: item.uploaderName || item.uploader, lengthSeconds: item.duration || item.lengthSeconds }, artist, title) }))
        .filter((e: any) => e.item.videoId)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 4);
      ranked.forEach((e: any) => addCandidate(e.item));
    }
  }

  if (candidates.length >= 4) return candidates.slice(0, 8);

  // Fallback to YouTube Data API (most reliable search)
  if (YOUTUBE_API_KEY) {
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=6&key=${YOUTUBE_API_KEY}`;
      const ytData = await fetchJson(ytUrl, 6000);
      const ytItems = Array.isArray(ytData?.items) ? ytData.items : [];
      for (const item of ytItems) {
        const vid = item?.id?.videoId;
        if (vid) {
          addCandidate({
            videoId: vid,
            title: item?.snippet?.title || '',
            author: item?.snippet?.channelTitle || '',
            _source: 'youtube-api',
          });
        }
      }
      console.log(`[search] YouTube API returned ${ytItems.length} results`);
    } catch (e) {
      console.warn(`[search] YouTube API failed:`, (e as Error).message);
    }
  }

  if (candidates.length >= 4) return candidates.slice(0, 8);

  // Last resort: Invidious
  const invInstances = getInvidiousInstances().filter(isHealthy).slice(0, 2);
  const invResults = await Promise.allSettled(
    invInstances.map(async (inst) => {
      try {
        const data = await fetchJson(`${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`, 6000);
        return Array.isArray(data) ? data.map((item: any) => ({ ...item, _source: inst })) : [];
      } catch (e) { markFailed(inst); throw e; }
    })
  );

  for (const r of invResults) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      const ranked = r.value
        .map((item: any) => ({ item, score: scoreVideo(item, artist, title) }))
        .filter((e: any) => e.item.videoId)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 4);
      ranked.forEach((e: any) => addCandidate(e.item));
    }
  }

  return candidates.slice(0, 8);
}

// ── Stream resolution: parallel race per candidate ──

function normalizeUrl(candidate: string | undefined, origin: string) {
  if (!candidate) return undefined;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  if (candidate.startsWith('/')) return `${origin}${candidate}`;
  return candidate;
}

function pickBestStream(data: Record<string, any>, instance: string) {
  const adaptive = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : [];
  const audio = adaptive
    .filter((f: any) => f.type?.startsWith('audio/'))
    .sort((a: any, b: any) => {
      const am = a.type?.includes('mp4') || a.container === 'm4a' ? 1 : 0;
      const bm = b.type?.includes('mp4') || b.container === 'm4a' ? 1 : 0;
      if (am !== bm) return bm - am;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });
  const chosen = audio[0] || (Array.isArray(data.formatStreams) ? data.formatStreams[0] : null);
  return normalizeUrl(chosen?.proxyUrl || chosen?.url, instance);
}

function pickBestPipedStream(data: Record<string, any>, instance: string) {
  const streams = Array.isArray(data.audioStreams) ? data.audioStreams : [];
  const best = streams
    .filter((s: any) => typeof s?.url === 'string')
    .sort((a: any, b: any) => {
      const am = a.mimeType?.includes('mp4') || a.format === 'm4a' ? 1 : 0;
      const bm = b.mimeType?.includes('mp4') || b.format === 'm4a' ? 1 : 0;
      if (am !== bm) return bm - am;
      return (b.bitrate || 0) - (a.bitrate || 0);
    })[0];
  return normalizeUrl(best?.proxyUrl || best?.url, instance);
}

async function resolveVideoId(videoId: string): Promise<{ streamUrl: string; duration?: number } | null> {
  // Priority: try piped.private.coffee FIRST (most reliable), then race others
  const piped = getPipedInstances().filter(isHealthy);
  const inv = getInvidiousInstances().filter(isHealthy);

  // Put the known-reliable instance first
  const primaryPiped = 'https://api.piped.private.coffee';
  const orderedPiped = [primaryPiped, ...piped.filter(i => i !== primaryPiped)].slice(0, 4);

  // Try primary first (fast path)
  try {
    const data = await fetchJson(`${primaryPiped}/streams/${videoId}`, 8000);
    const url = pickBestPipedStream(data, primaryPiped);
    if (url) {
      console.log(`[resolve] ✓ ${videoId} via ${primaryPiped}`);
      return { streamUrl: url, duration: Number(data.duration || 0) || undefined };
    }
  } catch (e) {
    console.warn(`[resolve] primary failed for ${videoId}:`, (e as Error).message);
  }

  // Fallback: race remaining instances
  const attempts = [
    ...orderedPiped.slice(1).map(async (inst) => {
      try {
        const data = await fetchJson(`${inst}/streams/${videoId}`, 7000);
        const url = pickBestPipedStream(data, inst);
        if (!url) throw new Error('no audio stream');
        console.log(`[resolve] ✓ ${videoId} via ${inst}`);
        return { streamUrl: url, duration: Number(data.duration || 0) || undefined };
      } catch (e) { markFailed(inst); throw e; }
    }),
    ...inv.slice(0, 2).map(async (inst) => {
      try {
        const data = await fetchJson(`${inst}/api/v1/videos/${videoId}`, 7000);
        const url = pickBestStream(data, inst);
        if (!url) throw new Error('no audio stream');
        console.log(`[resolve] ✓ ${videoId} via ${inst}`);
        return { streamUrl: url, duration: Number(data.lengthSeconds || 0) || undefined };
      } catch (e) { markFailed(inst); throw e; }
    }),
  ];

  if (!attempts.length) {
    console.warn(`[resolve] no instances available for ${videoId}`);
    return null;
  }

  try {
    return await Promise.any(attempts);
  } catch (e) {
    console.warn(`[resolve] all fallbacks failed for ${videoId}:`, (e as AggregateError)?.errors?.map((err: Error) => err.message)?.join(', '));
    return null;
  }
}

async function resolveStream(artist: string, title: string): Promise<ResolveResult> {
  const ck = `resolve:${artist}:${title}`;
  const cached = getCached<ResolveResult>(ck);
  if (cached) return cached;

  await refreshInstances();

  console.log(`[resolve] searching for: ${artist} - ${title}`);
  const candidates = await searchForCandidates(artist, title);
  console.log(`[resolve] found ${candidates.length} candidates: ${candidates.map(c => c.videoId).join(', ')}`);

  if (!candidates.length) {
    return { success: false, error: 'Could not find a playable stream for this track', fallback: true };
  }

  for (const candidate of candidates.slice(0, 6)) {
    const videoId = String(candidate.videoId);
    console.log(`[resolve] trying videoId: ${videoId}`);
    const resolved = await resolveVideoId(videoId);
    if (resolved) {
      const result: ResolveResult = {
        success: true,
        streamUrl: resolved.streamUrl,
        videoId,
        duration: resolved.duration || Number(candidate.lengthSeconds || candidate.duration || 0) || undefined,
        title, artist,
      };
      setCached(ck, result, 10 * 60 * 1000);
      return result;
    }
  }

  return { success: false, error: 'All stream sources are currently unavailable', fallback: true };
}

// ── HTTP handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    if (!LASTFM_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Last.fm is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const limit = Math.max(1, Math.min(30, typeof body.limit === 'number' ? body.limit : 24));
      if (query.length < 2) {
        return new Response(JSON.stringify({ success: false, error: 'Search query must be at least 2 characters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const results = await searchLastFm(query, limit);
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('music-indexer search error:', error);
        return new Response(JSON.stringify({ success: true, results: [], error: 'Search is temporarily unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'top') {
      const limit = Math.max(1, Math.min(20, typeof body.limit === 'number' ? body.limit : 20));
      try {
        const results = await getTopTracks(limit);
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('music-indexer top error:', error);
        return new Response(JSON.stringify({ success: true, results: [], error: 'Top tracks are temporarily unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'resolve') {
      const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!artist || !title) {
        return new Response(JSON.stringify({ success: false, error: 'Artist and title are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await resolveStream(artist, title);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unsupported action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('music-indexer error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error', fallback: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
