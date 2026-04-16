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
const STREAM_CACHE_TTL = 55 * 60 * 1000; // 55 min

function getCachedStream(key: string): { url: string; meta?: Partial<ResolveTrackResponse> } | null {
  const hit = streamCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) { streamCache.delete(key); return null; }
  return { url: hit.url, meta: hit.meta };
}

function setCachedStream(key: string, url: string, meta?: Partial<ResolveTrackResponse>) {
  streamCache.set(key, { url, expiresAt: Date.now() + STREAM_CACHE_TTL, meta });
}

// ── Fast fetch with timeout ──
async function fetchWithTimeout(url: string, ms = 5000, opts?: RequestInit): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } finally { clearTimeout(t); }
}

// ── Cobalt API (cobalt.tools - 100% free, open source) ──
const COBALT_INSTANCES = [
  'https://cobalt-api.kwiatekmiki.com',
  'https://cobalt.canine.tools',
  'https://api.cobalt.tools',
];

async function resolveViaCobalt(videoId: string): Promise<string | null> {
  for (const inst of COBALT_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${inst}/`, 6000, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          audioFormat: 'mp3',
          isAudioOnly: true,
          aFormat: 'mp3',
          filenamePattern: 'basic',
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.url) return data.url;
      if (data?.audio) return data.audio;
    } catch { continue; }
  }
  return null;
}

// ── Piped instances (reliable, fast) ──
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.r4fo.com',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.adminforge.de',
];

async function resolveViaPiped(videoId: string): Promise<string | null> {
  const race = PIPED_INSTANCES.slice(0, 3).map(async (inst) => {
    const res = await fetchWithTimeout(`${inst}/streams/${videoId}`, 5000, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('fail');
    const data = await res.json();
    const streams = data.audioStreams || [];
    const best = streams
      .filter((s: any) => s.mimeType?.startsWith('audio/'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (best?.url) return best.url;
    throw new Error('no audio');
  });

  try {
    return await (Promise as any).any(race);
  } catch { return null; }
}

// ── Invidious instances (fallback) ──
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
  'https://iv.datura.network',
  'https://invidious.protokolla.fi',
];

let lastWorkingInv = 0;

async function searchInvidiousDirect(query: string): Promise<{ videoId: string; title: string; artist: string }[]> {
  const instances = [...INVIDIOUS_INSTANCES];
  if (lastWorkingInv > 0) {
    const [best] = instances.splice(lastWorkingInv, 1);
    instances.unshift(best);
  }

  for (let i = 0; i < instances.length; i++) {
    try {
      const res = await fetchWithTimeout(
        `${instances[i]}/api/v1/search?q=${encodeURIComponent(query + ' audio')}&type=video&sort_by=relevance`,
        4000
      );
      if (!res.ok) continue;
      const items: any[] = await res.json();
      if (items.length > 0) {
        lastWorkingInv = INVIDIOUS_INSTANCES.indexOf(instances[i]);
        return items.slice(0, 5).map((item: any) => ({
          videoId: item.videoId,
          title: item.title || '',
          artist: item.author || '',
        }));
      }
    } catch { continue; }
  }
  return [];
}

async function resolveViaInvidious(videoId: string): Promise<string | null> {
  const instances = [...INVIDIOUS_INSTANCES];
  if (lastWorkingInv > 0) {
    const [best] = instances.splice(lastWorkingInv, 1);
    instances.unshift(best);
  }

  const race = instances.slice(0, 3).map(async (inst) => {
    const res = await fetchWithTimeout(`${inst}/api/v1/videos/${videoId}`, 5000);
    if (!res.ok) throw new Error('fail');
    const data = await res.json();
    const audio = (data.adaptiveFormats || [])
      .filter((f: any) => f.type?.startsWith('audio/'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audio.find((f: any) => f.type?.includes('mp4')) || audio[0];
    if (best?.url) {
      lastWorkingInv = INVIDIOUS_INSTANCES.indexOf(inst);
      return best.url;
    }
    throw new Error('no audio');
  });

  try {
    return await (Promise as any).any(race);
  } catch { return null; }
}

// ── Resolve a videoId to audio URL using ALL providers in parallel ──
async function resolveVideoToAudio(videoId: string): Promise<string | null> {
  // Race all 3 providers simultaneously for maximum speed
  const results = await Promise.allSettled([
    resolveViaPiped(videoId),
    resolveViaCobalt(videoId),
    resolveViaInvidious(videoId),
  ]);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

// ── Edge function caller ──
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-indexer`;

async function requestIndexer<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.success) {
      throw new Error(json?.error || `Request failed with status ${response.status}`);
    }
    return json as T;
  } finally {
    clearTimeout(timeout);
  }
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
  // 1. Check memory cache (instant)
  const cacheKey = `${artist.toLowerCase()}::${title.toLowerCase()}`;
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

  // 2. Search for video candidates (client-side direct, no edge function delay)
  const query = `${artist} ${title}`;
  const candidatesPromise = searchInvidiousDirect(query);

  // 3. Also try edge function in parallel
  const edgePromise = requestIndexer<ResolveTrackResponse>({
    action: 'resolve',
    artist,
    title,
  }).catch(() => null);

  // Wait for candidates first (usually faster)
  const candidates = await candidatesPromise;

  // 4. If we have candidates, resolve audio URL using all providers in parallel
  if (candidates.length > 0) {
    // Try first 3 candidates simultaneously
    const audioResults = await Promise.allSettled(
      candidates.slice(0, 3).map(c => resolveVideoToAudio(c.videoId))
    );

    for (let i = 0; i < audioResults.length; i++) {
      const r = audioResults[i];
      if (r.status === 'fulfilled' && r.value) {
        const streamUrl = r.value;
        setCachedStream(cacheKey, streamUrl, {
          title,
          artist,
          videoId: candidates[i].videoId,
        });
        return {
          success: true,
          streamUrl,
          videoId: candidates[i].videoId,
          title,
          artist,
        };
      }
    }
  }

  // 5. Check edge function result
  const edgeResult = await edgePromise;
  if (edgeResult?.success && edgeResult?.streamUrl) {
    setCachedStream(cacheKey, edgeResult.streamUrl, {
      title: edgeResult.title,
      artist: edgeResult.artist,
      cover_url: edgeResult.cover_url,
      duration: edgeResult.duration,
      videoId: edgeResult.videoId,
    });
    return edgeResult;
  }

  throw new Error('Could not find a playable stream for this track');
}
