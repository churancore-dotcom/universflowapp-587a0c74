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
const topTracksMemCache = new Map<number, { data: IndexedTrack[]; expiresAt: number }>();
let topTracksInflight = new Map<number, Promise<IndexedTrack[]>>();

(function hydrateTopTracksCache() {
  try {
    const raw = localStorage.getItem(TOP_TRACKS_LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { data: IndexedTrack[]; expiresAt: number }>;
    const now = Date.now();
    Object.entries(parsed).forEach(([k, v]) => {
      if (v?.expiresAt > now && Array.isArray(v.data)) {
        topTracksMemCache.set(Number(k), v);
      }
    });
  } catch { /* ignore */ }
})();

function persistTopTracksCache() {
  try {
    const obj: Record<string, { data: IndexedTrack[]; expiresAt: number }> = {};
    topTracksMemCache.forEach((v, k) => { obj[String(k)] = v; });
    localStorage.setItem(TOP_TRACKS_LS_KEY, JSON.stringify(obj));
  } catch { /* ignore quota */ }
}

export async function getTopIndexedTracks(limit = 30): Promise<IndexedTrack[]> {
  const cached = topTracksMemCache.get(limit);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const inflight = topTracksInflight.get(limit);
  if (inflight) return inflight;

  const promise = (async () => {
    const data = await requestIndexer<IndexedTracksResponse>({
      action: 'top',
      limit,
    });
    const results = Array.isArray(data.results) ? data.results : [];
    if (results.length > 0) {
      topTracksMemCache.set(limit, { data: results, expiresAt: Date.now() + TOP_TRACKS_TTL });
      persistTopTracksCache();
    }
    return results;
  })();
  topTracksInflight.set(limit, promise);
  try {
    return await promise;
  } finally {
    topTracksInflight.delete(limit);
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

// Country viral chart (Last.fm geo.getTopTracks). Returns real per-country trending tracks.
export async function getGeoTopTracks(country: string, limit = 30): Promise<IndexedTrack[]> {
  if (!country) return [];
  try {
    const data = await requestIndexer<IndexedTracksResponse & { country?: string }>({
      action: 'geo-top',
      country,
      limit,
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

// Mood/genre tag chart (Last.fm tag.getTopTracks). e.g. "chill", "sad", "workout".
export async function getTagTopTracks(tag: string, limit = 30): Promise<IndexedTrack[]> {
  if (!tag) return [];
  try {
    const data = await requestIndexer<IndexedTracksResponse & { tag?: string }>({
      action: 'tag-top',
      tag,
      limit,
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

// Top tracks for a single artist (used for non-catalog followed artists).
export async function getArtistTopTracksByName(artist: string, limit = 12): Promise<IndexedTrack[]> {
  if (!artist) return [];
  try {
    const data = await requestIndexer<IndexedTracksResponse>({
      action: 'artist-top',
      artist,
      limit,
    });
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}
