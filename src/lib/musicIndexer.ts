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

// ── In-memory stream cache ──
const streamCache = new Map<string, { url: string; expiresAt: number; meta?: Partial<ResolveTrackResponse> }>();
const inFlightResolutions = new Map<string, Promise<ResolveTrackResponse>>();
const STREAM_CACHE_TTL = 55 * 60 * 1000; // 55 min

function makeCacheKey(artist: string, title: string) {
  return `${artist.toLowerCase()}::${title.toLowerCase()}`;
}

function getCachedStream(key: string): { url: string; meta?: Partial<ResolveTrackResponse> } | null {
  const hit = streamCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) { streamCache.delete(key); return null; }
  return { url: hit.url, meta: hit.meta };
}

function setCachedStream(key: string, url: string, meta?: Partial<ResolveTrackResponse>) {
  streamCache.set(key, { url, expiresAt: Date.now() + STREAM_CACHE_TTL, meta });
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

export async function getTopIndexedTracks(limit = 30): Promise<IndexedTrack[]> {
  const data = await requestIndexer<IndexedTracksResponse>({
    action: 'top',
    limit,
  });
  return Array.isArray(data.results) ? data.results : [];
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
  })().finally(() => {
    inFlightResolutions.delete(cacheKey);
  });

  inFlightResolutions.set(cacheKey, pending);
  return pending;
}

export function prefetchIndexedTrack(artist: string, title: string) {
  const cacheKey = makeCacheKey(artist, title);
  if (getCachedStream(cacheKey) || inFlightResolutions.has(cacheKey)) return;
  void resolveIndexedTrack(artist, title).catch(() => null);
}
