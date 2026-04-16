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

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  artist: string;
  cover_url?: string;
  duration?: number;
}

interface YouTubeSearchResponse {
  success: boolean;
  results?: YouTubeSearchResult[];
  error?: string;
}

interface ExtractAudioResponse {
  success: boolean;
  audioUrl?: string;
  title?: string;
  artist?: string;
  duration?: number;
  error?: string;
}

// ── In-memory stream cache (survives across navigations) ──
const streamCache = new Map<string, { url: string; expiresAt: number; meta?: Partial<ResolveTrackResponse> }>();
const STREAM_CACHE_TTL = 40 * 60 * 1000; // 40 min

function getCachedStream(key: string): { url: string; meta?: Partial<ResolveTrackResponse> } | null {
  const hit = streamCache.get(key);
  if (!hit || hit.expiresAt < Date.now()) { streamCache.delete(key); return null; }
  return { url: hit.url, meta: hit.meta };
}

function setCachedStream(key: string, url: string, meta?: Partial<ResolveTrackResponse>) {
  streamCache.set(key, { url, expiresAt: Date.now() + STREAM_CACHE_TTL, meta });
}

// ── Invidious direct resolution (client-side, no edge function needed) ──
const INVIDIOUS_DIRECT = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
  'https://iv.datura.network',
  'https://invidious.protokolla.fi',
  'https://invidious.jing.rocks',
  'https://iv.nboez.cc',
  'https://invidious.slipfox.xyz',
];

let lastWorkingInv = 0;

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
  } finally { clearTimeout(t); }
}

async function searchInvidiousDirect(query: string): Promise<{ videoId: string; title: string; artist: string }[]> {
  const instances = [...INVIDIOUS_DIRECT];
  if (lastWorkingInv > 0) {
    const [best] = instances.splice(lastWorkingInv, 1);
    instances.unshift(best);
  }

  for (let i = 0; i < instances.length; i++) {
    try {
      const res = await fetchWithTimeout(
        `${instances[i]}/api/v1/search?q=${encodeURIComponent(query + ' audio')}&type=video&sort_by=relevance`,
        5000
      );
      if (!res.ok) continue;
      const items: any[] = await res.json();
      if (items.length > 0) {
        lastWorkingInv = INVIDIOUS_DIRECT.indexOf(instances[i]);
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

async function resolveStreamDirect(videoId: string): Promise<string | null> {
  const instances = [...INVIDIOUS_DIRECT];
  if (lastWorkingInv > 0) {
    const [best] = instances.splice(lastWorkingInv, 1);
    instances.unshift(best);
  }

  // Race first 4 instances
  const raceInstances = instances.slice(0, 4);
  try {
    return await (Promise as any).any(raceInstances.map(async (inst) => {
      const res = await fetchWithTimeout(`${inst}/api/v1/videos/${videoId}`, 5000);
      if (!res.ok) throw new Error('fail');
      const data = await res.json();
      const audio = (data.adaptiveFormats || [])
        .filter((f: any) => f.type?.startsWith('audio/'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = audio.find((f: any) => f.type?.includes('mp4')) || audio[0];
      if (best?.url) {
        lastWorkingInv = INVIDIOUS_DIRECT.indexOf(inst);
        return best.url;
      }
      throw new Error('no audio');
    }));
  } catch { return null; }
}

// ── Edge function caller ──

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-indexer`;

async function requestIndexer<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

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

// ── YouTube fallback via edge functions ──

async function resolveViaYouTubeFallback(artist: string, title: string): Promise<ResolveTrackResponse | null> {
  const query = `${artist} ${title}`.trim();

  const { data: searchData, error: searchError } = await supabase.functions.invoke('yt-music-search', {
    body: { query },
  });

  const parsedSearch = searchData as YouTubeSearchResponse | null;
  if (searchError || !parsedSearch?.success || !Array.isArray(parsedSearch.results) || parsedSearch.results.length === 0) {
    return null;
  }

  const bestMatch = parsedSearch.results[0];
  if (!bestMatch?.videoId) return null;

  const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-audio', {
    body: { url: `https://www.youtube.com/watch?v=${bestMatch.videoId}` },
  });

  const parsedExtract = extractData as ExtractAudioResponse | null;
  if (extractError || !parsedExtract?.success || !parsedExtract.audioUrl) {
    return null;
  }

  return {
    success: true,
    streamUrl: parsedExtract.audioUrl,
    videoId: bestMatch.videoId,
    duration: parsedExtract.duration || bestMatch.duration,
    title: parsedExtract.title || bestMatch.title || title,
    artist: parsedExtract.artist || bestMatch.artist || artist,
  };
}

// ── Direct client-side resolution (no edge function) ──

async function resolveViaDirectInvidious(artist: string, title: string): Promise<ResolveTrackResponse | null> {
  const query = `${artist} ${title}`;
  const candidates = await searchInvidiousDirect(query);
  if (!candidates.length) return null;

  for (const c of candidates.slice(0, 3)) {
    const streamUrl = await resolveStreamDirect(c.videoId);
    if (streamUrl) {
      return {
        success: true,
        streamUrl,
        videoId: c.videoId,
        title,
        artist,
      };
    }
  }
  return null;
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
  // 1. Check memory cache first (instant)
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

  // 2. Race: edge function vs direct client-side resolution
  const edgeFunctionPromise = requestIndexer<ResolveTrackResponse>({
    action: 'resolve',
    artist,
    title,
  }).catch(() => null);

  const directPromise = resolveViaDirectInvidious(artist, title).catch(() => null);

  // Wait for the first successful result
  const results = await Promise.allSettled([edgeFunctionPromise, directPromise]);
  
  let winner: ResolveTrackResponse | null = null;

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value?.success && r.value?.streamUrl) {
      winner = r.value;
      break;
    }
  }

  if (winner?.streamUrl) {
    setCachedStream(cacheKey, winner.streamUrl, {
      title: winner.title,
      artist: winner.artist,
      cover_url: winner.cover_url,
      duration: winner.duration,
      videoId: winner.videoId,
    });
    return winner;
  }

  // 3. Last resort: yt-music-search + extract-audio edge functions
  const fallback = await resolveViaYouTubeFallback(artist, title).catch(() => null);
  if (fallback?.streamUrl) {
    setCachedStream(cacheKey, fallback.streamUrl, {
      title: fallback.title,
      artist: fallback.artist,
      duration: fallback.duration,
      videoId: fallback.videoId,
    });
    return fallback;
  }

  throw new Error('Could not find a playable stream for this track');
}
