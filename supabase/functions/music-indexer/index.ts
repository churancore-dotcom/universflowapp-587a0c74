import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUDIO_PROXY_ALLOWED_HOST_SNIPPETS = [
  'private.coffee',
  'googlevideo.com',
  'youtube.com',
  'youtu.be',
  'invidious',
  'piped',
];

const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY') || '';
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
  'https://pipedapi.r4fo.com',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.private.coffee',
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.protokolla.fi',
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
  duration?: number; title?: string; artist?: string; cover_url?: string; error?: string; fallback?: boolean;
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

async function getDeezerArtwork(artist: string, title: string): Promise<string | undefined> {
  const cacheKey = `deezer-art:${artist}:${title}`;
  const cached = getCached<string | null>(cacheKey);
  if (cached !== null) return cached || undefined;

  try {
    const url = new URL('https://api.deezer.com/search');
    url.searchParams.set('q', `artist:"${artist}" track:"${title}"`);
    url.searchParams.set('limit', '5');

    const data = await fetchJson(url.toString(), 5000);
    const results = Array.isArray(data?.data) ? data.data : [];
    const best = results
      .map((item: Record<string, any>) => ({
        item,
        score: scoreMetadataCandidate(
          {
            artistName: item?.artist?.name,
            trackName: item?.title,
          },
          artist,
          title,
        ),
      }))
      .sort((a, b) => b.score - a.score)[0]?.item;

    const artwork = sanitizeArtwork(String(best?.album?.cover_xl || best?.album?.cover_big || best?.album?.cover_medium || ''));
    setCached(cacheKey, artwork || null, 12 * 60 * 60 * 1000);
    return artwork;
  } catch {
    setCached(cacheKey, null, 30 * 60 * 1000);
    return undefined;
  }
}

async function resolveArtwork(artist: string, title: string, preferred?: string) {
  const safePreferred = sanitizeArtwork(preferred);
  if (safePreferred) return safePreferred;

  const deezerArtwork = await getDeezerArtwork(artist, title);
  if (deezerArtwork) return deezerArtwork;

  return getItunesArtwork(artist, title);
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
  const artwork = await resolveArtwork(track.artist, track.title, track.cover_url);
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

// Rotating discovery tags so Top 30 keeps refreshing
const DISCOVERY_TAGS = [
  'pop', 'hip-hop', 'rock', 'electronic', 'r&b', 'indie',
  'dance', 'k-pop', 'latin', 'edm', 'rap', 'house', 'alternative', 'trap',
];

async function getTopTracks(limit = 30) {
  // Rotation key changes every ~5 minutes so the chart visibly refreshes
  const rotation = Math.floor(Date.now() / (5 * 60 * 1000));
  const ck = `top-rotated:${limit}:${rotation}`;
  const c = getCached<IndexedTrack[]>(ck);
  if (c) return c;

  // Pick 2 random tags + global chart for the freshest blend
  const shuffled = [...DISCOVERY_TAGS].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 2);
  const perBucket = Math.ceil(limit / 2) + 5;

  const fetches: Promise<LastFmTrack[]>[] = [
    fetchJson(buildLastFmUrl('chart.gettoptracks', { limit: String(perBucket), page: String((rotation % 3) + 1) }))
      .then((d) => (Array.isArray(d?.tracks?.track) ? d.tracks.track : []))
      .catch(() => []),
    ...picks.map((tag) =>
      fetchJson(buildLastFmUrl('tag.gettoptracks', { tag, limit: String(perBucket), page: String((rotation % 4) + 1) }))
        .then((d) => (Array.isArray(d?.tracks?.track) ? d.tracks.track : []))
        .catch(() => []),
    ),
  ];

  const buckets = await Promise.all(fetches);
  const merged: LastFmTrack[] = [];
  // Interleave so chart top + tag picks mix nicely
  const maxLen = Math.max(...buckets.map((b) => b.length));
  for (let i = 0; i < maxLen; i += 1) {
    for (const bucket of buckets) {
      if (bucket[i]) merged.push(bucket[i]);
    }
  }

  const enriched = await Promise.all(merged.slice(0, limit + 4).map(async (t) => {
    const info = t.name ? await getTrackInfo(getArtistName(t.artist), t.name) : null;
    const mapped = mapTrack(t, info);
    return mapped ? hydrateTrackArtwork(mapped) : null;
  }));
  // Re-shuffle slightly so order doesn't feel mechanical
  const unique = uniqueTracks(enriched).sort(() => Math.random() - 0.35);
  const results = unique.slice(0, limit).map((t, i) => ({ ...t, rank: i + 1 }));
  setCached(ck, results, 5 * 60 * 1000);
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

function isCorsCompatible(url: string) {
  // Piped proxy URLs have CORS; raw googlevideo.com does NOT
  if (!url) return false;
  if (url.includes('googlevideo.com') && !url.includes('proxy.')) return false;
  return true;
}

function isAllowedAudioProxyUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return AUDIO_PROXY_ALLOWED_HOST_SNIPPETS.some((snippet) => parsed.hostname.includes(snippet));
  } catch {
    return false;
  }
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
  // ALWAYS prefer proxyUrl for CORS compatibility in browser
  const raw = normalizeUrl(chosen?.proxyUrl, instance) || normalizeUrl(chosen?.url, instance);
  return raw;
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
    ...inv.slice(0, 3).map(async (inst) => {
      try {
        const data = await fetchJson(`${inst}/api/v1/videos/${videoId}`, 7000);
        const url = pickBestStream(data, inst);
        if (!url) throw new Error('no audio stream');
        // Skip non-CORS URLs — they will fail in browser playback
        if (!isCorsCompatible(url)) {
          console.warn(`[resolve] skipping non-CORS stream from ${inst}`);
          throw new Error('non-CORS stream');
        }
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

  let firstVideoId: string | null = null;
  for (const candidate of candidates.slice(0, 6)) {
    const videoId = String(candidate.videoId);
    if (!firstVideoId) firstVideoId = videoId;
    console.log(`[resolve] trying videoId: ${videoId}`);
    const resolved = await resolveVideoId(videoId);
    if (resolved) {
      const result: ResolveResult = {
        success: true,
        streamUrl: resolved.streamUrl,
        videoId,
        duration: resolved.duration || Number(candidate.lengthSeconds || candidate.duration || 0) || undefined,
        title, artist,
          cover_url: await resolveArtwork(artist, title),
      };
      setCached(ck, result, 45 * 60 * 1000); // cache resolved streams for 45 min
      return result;
    }
  }

  // YouTube IFrame fallback — guaranteed playback even when no audio host is reachable
  if (firstVideoId) {
    const fallback: ResolveResult = {
      success: true,
      streamUrl: `yt-video:${firstVideoId}`,
      videoId: firstVideoId,
      title, artist,
      cover_url: await resolveArtwork(artist, title),
      fallback: true,
    };
    setCached(ck, fallback, 30 * 60 * 1000);
    return fallback;
  }

  return { success: false, error: 'All stream sources are currently unavailable', fallback: true };
}

// ── HTTP handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const audioTarget = requestUrl.searchParams.get('audio');

    if ((req.method === 'GET' || req.method === 'HEAD') && audioTarget) {
      if (!isAllowedAudioProxyUrl(audioTarget)) {
        return new Response('Invalid audio source', { status: 400, headers: corsHeaders });
      }

      const range = req.headers.get('range');
      const upstream = await fetch(audioTarget, {
        method: req.method,
        headers: {
          ...(range ? { range } : {}),
          'user-agent': 'Mozilla/5.0 (UniversFlow Audio Proxy)',
          accept: '*/*',
        },
      });

      const headers = new Headers(corsHeaders);
      ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified'].forEach((name) => {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      });

      return new Response(req.method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    // ── Auth check ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    if (!LASTFM_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Last.fm is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const limit = Math.max(1, Math.min(60, typeof body.limit === 'number' ? body.limit : 50));
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
      const limit = Math.max(1, Math.min(50, typeof body.limit === 'number' ? body.limit : 30));
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
