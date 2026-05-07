import { supabase } from '@/integrations/supabase/client';

export interface IndexedTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  duration?: number;
  listeners?: number;
  rank?: number;
  videoId?: string;
}

interface IndexedTracksResponse {
  success: boolean;
  results?: IndexedTrack[];
  error?: string;
}

interface ResolveTrackResponse {
  success: boolean;
  streamUrl?: string;
  videoId?: string;
  duration?: number;
  title?: string;
  artist?: string;
  cover_url?: string;
  error?: string;
  fallback?: boolean;
}

// ── Persistent stream cache (localStorage + memory) ──
// Memory cache for instant hits, localStorage for survival across reloads.
// TTL is 55min because most CDN signed URLs from the resolver are valid ~1h.
const streamCache = new Map<string, { url: string; expiresAt: number; meta?: Partial<ResolveTrackResponse> }>();
const inFlightResolutions = new Map<string, Promise<ResolveTrackResponse>>();
const STREAM_CACHE_TTL = 55 * 60 * 1000; // 55 min
const LS_KEY = 'uf_stream_cache_v1';
const LS_MAX_ENTRIES = 200;

function makeCacheKey(artist: string, title: string) {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim()}`;
}

// Hydrate from localStorage on module load (one-time)
(function hydrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { url: string; expiresAt: number; meta?: any }>;
    const now = Date.now();
    for (const [key, val] of Object.entries(parsed)) {
      if (val?.expiresAt > now && val?.url) streamCache.set(key, val);
    }
  } catch { /* ignore corrupted cache */ }
})();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistCache() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // Trim to most recent N entries by expiresAt to stay under quota
      const entries = Array.from(streamCache.entries())
        .filter(([, v]) => v.expiresAt > Date.now())
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
        .slice(0, LS_MAX_ENTRIES);
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* quota errors etc — ignore */ }
  }, 1500);
}

function getCachedStream(key: string): { url: string; meta?: Partial<ResolveTrackResponse> } | null {
  const hit = streamCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) { streamCache.delete(key); return null; }
  return { url: hit.url, meta: hit.meta };
}

function setCachedStream(key: string, url: string, meta?: Partial<ResolveTrackResponse>) {
  streamCache.set(key, { url, expiresAt: Date.now() + STREAM_CACHE_TTL, meta });
  persistCache();
}

// Try to grab a cached audio_url directly from the DB (stream_songs table) before
// hitting the edge function. This is shared across ALL users — instant warm cache.
async function tryDbCachedStream(artist: string, title: string): Promise<ResolveTrackResponse | null> {
  try {
    const { data } = await supabase
      .from('stream_songs')
      .select('audio_url, title, artist, cover_url, duration, last_seen_at')
      .eq('artist', artist)
      .eq('title', title)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.audio_url) return null;
    // Treat audio_url as fresh if seen in last 4h (server refreshes on resolve)
    const ageMs = Date.now() - new Date(data.last_seen_at).getTime();
    if (ageMs > 4 * 60 * 60 * 1000) return null;

    return {
      success: true,
      streamUrl: data.audio_url,
      title: data.title,
      artist: data.artist,
      cover_url: data.cover_url || undefined,
      duration: data.duration || undefined,
    };
  } catch {
    return null;
  }
}

async function requestFunction<T>(functionName: string, body: Record<string, unknown>, requireSuccess = false): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new Error(error.message || 'Function request failed');
  }

  if (requireSuccess && !data?.success) {
    throw new Error(data?.error || 'Function request failed');
  }

  return data as T;
}

async function requestIndexer<T>(body: Record<string, unknown>): Promise<T> {
  return requestFunction<T>('music-indexer', body, true);
}

// ── Public API ──

export async function searchIndexedTracks(query: string, limit = 50): Promise<IndexedTrack[]> {
  const data = await requestIndexer<IndexedTracksResponse>({
    action: 'search',
    query,
    limit,
  });
  return Array.isArray(data.results) ? data.results : [];
}

// Session-level cache for Global Top tracks so they don't refetch every time
// the user navigates back to Home. Survives across mounts during the session;
// localStorage layer survives across reloads (TTL 30 minutes).
const TOP_TRACKS_TTL = 30 * 60 * 1000;
const TOP_TRACKS_LS_KEY = 'uf_top_tracks_v1';
const topTracksMemCache = new Map<string, { data: IndexedTrack[]; expiresAt: number }>();
let topTracksInflight = new Map<string, Promise<IndexedTrack[]>>();

// Detect a 2-letter country code using browser language + timezone heuristics.
// Cached after first compute. Falls back to '' (server uses global blend).
let _detectedCountry: string | null = null;
export function detectCountry(): string {
  if (_detectedCountry !== null) return _detectedCountry;
  let cc = '';
  try {
    // 1) Locale region (e.g. en-IN → IN)
    const langs = [navigator.language, ...(navigator.languages || [])];
    for (const lang of langs) {
      const m = /-([A-Z]{2})\b/i.exec(lang || '');
      if (m) { cc = m[1].toUpperCase(); break; }
    }
    // 2) Timezone heuristic
    if (!cc) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const TZ_MAP: Record<string, string> = {
        'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
        'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD',
        'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
        'Asia/Shanghai': 'CN', 'Asia/Singapore': 'SG',
        'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
        'Europe/London': 'GB', 'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
        'Europe/Moscow': 'RU',
        'America/New_York': 'US', 'America/Los_Angeles': 'US', 'America/Chicago': 'US',
        'America/Toronto': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
        'Australia/Sydney': 'AU',
      };
      cc = TZ_MAP[tz] || '';
    }
  } catch { /* ignore */ }
  _detectedCountry = cc;
  return cc;
}

(function hydrateTopTracksCache() {
  try {
    const raw = localStorage.getItem(TOP_TRACKS_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { data: IndexedTrack[]; expiresAt: number }>;
    const now = Date.now();
    Object.entries(parsed).forEach(([k, v]) => {
      if (v?.expiresAt > now && Array.isArray(v.data)) {
        topTracksMemCache.set(k, v);
      }
    });
  } catch { /* ignore */ }
})();

function persistTopTracksCache() {
  try {
    const obj: Record<string, { data: IndexedTrack[]; expiresAt: number }> = {};
    topTracksMemCache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(TOP_TRACKS_LS_KEY, JSON.stringify(obj));
  } catch { /* ignore quota */ }
}

export async function getTopIndexedTracks(limit = 30, country?: string): Promise<IndexedTrack[]> {
  // Pass empty country by default → edge function detects from request IP (respects VPNs).
  const cc = (country ?? '').toUpperCase().slice(0, 2);
  const key = `${limit}::${cc || 'auto'}`;
  const cached = topTracksMemCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const inflight = topTracksInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const data = await requestIndexer<IndexedTracksResponse>({
      action: 'top',
      limit,
      country: cc || undefined,
    });
    const results = Array.isArray(data.results) ? data.results : [];
    if (results.length > 0) {
      topTracksMemCache.set(key, { data: results, expiresAt: Date.now() + TOP_TRACKS_TTL });
      persistTopTracksCache();
    }
    return results;
  })();
  topTracksInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    topTracksInflight.delete(key);
  }
}

export async function resolveIndexedTrack(artist: string, title: string): Promise<ResolveTrackResponse> {
  const cacheKey = makeCacheKey(artist, title);
  const cached = getCachedStream(cacheKey);
  if (cached) {
    return {
      success: true,
      streamUrl: cached.url,
      title: cached.meta?.title || title,
      artist: cached.meta?.artist || artist,
      cover_url: cached.meta?.cover_url,
      duration: cached.meta?.duration,
      videoId: cached.meta?.videoId,
    };
  }

  const existing = inFlightResolutions.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    // FAST PATH: try DB cache first (shared across all users, ~80ms)
    // before falling back to the slow Invidious resolver (~1-2s).
    const dbHit = await tryDbCachedStream(artist, title);
    if (dbHit?.streamUrl) {
      setCachedStream(cacheKey, dbHit.streamUrl, {
        title: dbHit.title,
        artist: dbHit.artist,
        cover_url: dbHit.cover_url,
        duration: dbHit.duration,
      });
      return dbHit;
    }

    return await resolveViaEdgeFunction(artist, title, cacheKey);
  })().finally(() => {
    inFlightResolutions.delete(cacheKey);
  });

  inFlightResolutions.set(cacheKey, pending);
  return pending;
}

async function resolveViaEdgeFunction(artist: string, title: string, cacheKey: string): Promise<ResolveTrackResponse> {
  const result = await requestIndexer<ResolveTrackResponse>({
    action: 'resolve',
    artist,
    title,
  });

  if (!result?.success || !result.streamUrl) {
    throw new Error(result?.error || 'Could not find a playable stream for this track');
  }

  setCachedStream(cacheKey, result.streamUrl, {
    title: result.title,
    artist: result.artist,
    cover_url: result.cover_url,
    duration: result.duration,
    videoId: result.videoId,
  });

  return result;
}


export function prefetchIndexedTrack(artist: string, title: string) {
  const cacheKey = makeCacheKey(artist, title);
  if (getCachedStream(cacheKey) || inFlightResolutions.has(cacheKey)) return;
  void resolveIndexedTrack(artist, title).catch(() => null);
}

// ── Artist directory (with real PFPs from Deezer) ──

export interface IndexedArtistInfo {
  name: string;
  image_url?: string;
  listeners?: number;
}

interface ArtistDirectoryResponse {
  success: boolean;
  results?: IndexedArtistInfo[];
  error?: string;
}

interface ArtistImagesResponse {
  success: boolean;
  results?: Record<string, string>;
  error?: string;
}

export async function searchArtistDirectory(query: string, limit = 30): Promise<IndexedArtistInfo[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const data = await requestIndexer<ArtistDirectoryResponse>({
      action: 'search-artists',
      query: query.trim(),
      limit,
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export async function getTopArtistsByTag(tag: string, limit = 40): Promise<IndexedArtistInfo[]> {
  try {
    const data = await requestIndexer<ArtistDirectoryResponse>({
      action: 'top-artists',
      tag,
      limit,
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export async function enrichArtistImages(names: string[]): Promise<Record<string, string>> {
  const filtered = names.filter((n) => typeof n === 'string' && n.trim()).slice(0, 60);
  if (!filtered.length) return {};
  try {
    const data = await requestIndexer<ArtistImagesResponse>({
      action: 'enrich-artist-images',
      names: filtered,
    });
    return data.results && typeof data.results === 'object' ? data.results : {};
  } catch {
    return {};
  }
}
