import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY') || '9560c1d6069ed833e8104e1ef8ee9e95';

const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.private.coffee',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.protokolla.fi',
  'https://invidious.fdn.fr',
  'https://invidious.perennialte.ch',
  'https://invidious.slipfox.xyz',
  'https://invidious.jing.rocks',
  'https://iv.nboez.cc',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://pipedapi.leptons.xyz',
];

type LastFmTrack = {
  name?: string;
  artist?: string | { name?: string };
  listeners?: string;
  duration?: string;
  album?: { title?: string; image?: Array<{ '#text'?: string }> };
  image?: Array<{ '#text'?: string }>;
  url?: string;
  streamable?: { '#text'?: string; fulltrack?: string };
  '@attr'?: { rank?: string };
};

type IndexedTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  duration?: number;
  listeners?: number;
  rank?: number;
};

type ResolveResult = {
  success: boolean;
  streamUrl?: string;
  videoId?: string;
  duration?: number;
  title?: string;
  artist?: string;
  error?: string;
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeTrackId(artist: string, title: string) {
  return `lfm-${normalizeText(artist).replace(/\s+/g, '-')}-${normalizeText(title).replace(/\s+/g, '-')}`;
}

function getArtistName(artist: LastFmTrack['artist']) {
  if (typeof artist === 'string') return artist;
  return artist?.name || 'Unknown Artist';
}

function getExtralargeImage(images?: Array<{ '#text'?: string }>) {
  return images?.[3]?.['#text'] || '';
}

async function fetchJson(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'UniversFlow/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildLastFmUrl(method: string, params: Record<string, string>) {
  const url = new URL(LASTFM_BASE_URL);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', LASTFM_API_KEY);
  url.searchParams.set('format', 'json');

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function getTrackInfo(artist: string, track: string): Promise<LastFmTrack | null> {
  const cacheKey = `info:${artist}:${track}`;
  const cached = getCached<LastFmTrack | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const data = await fetchJson(buildLastFmUrl('track.getInfo', {
      artist,
      track,
      autocorrect: '1',
    }));

    const result = (data?.track || null) as LastFmTrack | null;
    setCached(cacheKey, result, 15 * 60 * 1000);
    return result;
  } catch {
    setCached(cacheKey, null, 2 * 60 * 1000);
    return null;
  }
}

function mapTrack(baseTrack: LastFmTrack, infoTrack?: LastFmTrack | null): IndexedTrack | null {
  const title = infoTrack?.name || baseTrack?.name || '';
  const artist = getArtistName(infoTrack?.artist || baseTrack?.artist);

  if (!title || !artist) return null;

  const cover_url = getExtralargeImage(infoTrack?.album?.image) || getExtralargeImage(infoTrack?.image) || getExtralargeImage(baseTrack?.image) || getExtralargeImage(baseTrack?.album?.image) || undefined;
  const rawDuration = infoTrack?.duration || baseTrack?.duration;
  const duration = rawDuration ? Math.round(Number(rawDuration) / (Number(rawDuration) > 1000 ? 1000 : 1)) : undefined;
  const listeners = Number(infoTrack?.listeners || baseTrack?.listeners || 0) || undefined;
  const rank = Number(baseTrack?.['@attr']?.rank || infoTrack?.['@attr']?.rank || 0) || undefined;

  return {
    id: makeTrackId(artist, title),
    title,
    artist,
    album: infoTrack?.album?.title || baseTrack?.album?.title,
    cover_url,
    duration,
    listeners,
    rank,
  };
}

function uniqueTracks(tracks: Array<IndexedTrack | null>) {
  const seen = new Set<string>();
  return tracks.filter((track): track is IndexedTrack => {
    if (!track) return false;
    const key = `${normalizeText(track.artist)}::${normalizeText(track.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchLastFm(query: string, limit = 12) {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached<IndexedTrack[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(buildLastFmUrl('track.search', {
    track: query,
    limit: String(limit),
  }));

  const rawTracks = data?.results?.trackmatches?.track;
  const matches: LastFmTrack[] = Array.isArray(rawTracks) ? rawTracks : rawTracks ? [rawTracks] : [];

  const enriched = await Promise.all(matches.slice(0, limit).map(async (track) => {
    const info = track.name ? await getTrackInfo(getArtistName(track.artist), track.name) : null;
    return mapTrack(track, info);
  }));

  const results = uniqueTracks(enriched);
  setCached(cacheKey, results, 5 * 60 * 1000);
  return results;
}

async function getTopTracks(limit = 20) {
  const cacheKey = `top:${limit}`;
  const cached = getCached<IndexedTrack[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson(buildLastFmUrl('chart.gettoptracks', {
    limit: String(limit),
  }));

  const rawTracks = data?.tracks?.track;
  const tracks: LastFmTrack[] = Array.isArray(rawTracks) ? rawTracks : [];

  const enriched = await Promise.all(tracks.slice(0, limit).map(async (track) => {
    const artist = getArtistName(track.artist);
    const info = track.name ? await getTrackInfo(artist, track.name) : null;
    return mapTrack(track, info);
  }));

  const results = uniqueTracks(enriched).slice(0, limit);
  setCached(cacheKey, results, 15 * 60 * 1000);
  return results;
}

function scoreVideoCandidate(item: Record<string, unknown>, artist: string, title: string) {
  const itemTitle = normalizeText(String(item.title || ''));
  const itemArtist = normalizeText(String(item.author || ''));
  const wantedArtist = normalizeText(artist);
  const wantedTitle = normalizeText(title);
  const duration = Number(item.lengthSeconds || 0);

  let score = 0;

  if (wantedTitle && itemTitle.includes(wantedTitle)) score += 12;
  if (wantedArtist && itemTitle.includes(wantedArtist)) score += 4;
  if (wantedArtist && itemArtist.includes(wantedArtist)) score += 8;

  const titleWords = wantedTitle.split(' ').filter((word) => word.length > 2);
  score += titleWords.filter((word) => itemTitle.includes(word)).length * 1.5;

  const penalties = ['karaoke', 'sped up', 'slowed', 'reverb', '8d audio', 'nightcore', 'live', 'cover', 'remix', 'instrumental'];
  penalties.forEach((term) => {
    if (itemTitle.includes(term) && !wantedTitle.includes(term)) {
      score -= 5;
    }
  });

  if (duration >= 60 && duration <= 900) score += 2;
  else score -= 2;

  return score;
}

function normalizeExternalUrl(candidate: string | undefined, origin: string) {
  if (!candidate) return undefined;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  if (candidate.startsWith('/')) return `${origin}${candidate}`;
  return candidate;
}

function extractVideoId(candidate: unknown) {
  if (typeof candidate !== 'string') return undefined;

  const directMatch = candidate.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directMatch) return directMatch[0];

  const watchMatch = candidate.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch?.[1]) return watchMatch[1];

  return undefined;
}

async function searchInvidious(artist: string, title: string) {
  const query = encodeURIComponent(`${artist} ${title} audio`);
  const candidates: Record<string, unknown>[] = [];

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/api/v1/search?q=${query}&type=video&sort_by=relevance`, 8000);
      const items = Array.isArray(data) ? data : [];

      const ranked = items
        .map((item) => ({ item, score: scoreVideoCandidate(item, artist, title) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      for (const entry of ranked) {
        if (entry?.item?.videoId) {
          candidates.push(entry.item as Record<string, unknown>);
        }
      }

      if (candidates.length >= 4) {
        return candidates;
      }
    } catch (error) {
      console.warn(`Search instance failed: ${instance}`, error);
    }
  }

  return candidates;
}

async function searchPiped(artist: string, title: string) {
  const query = encodeURIComponent(`${artist} ${title} audio`);
  const candidates: Record<string, unknown>[] = [];

  for (const instance of PIPED_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/search?q=${query}&filter=videos`, 8000);
      const rawItems = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      const ranked = rawItems
        .map((item) => {
          const record = item as Record<string, unknown>;
          const videoId = typeof record.videoId === 'string' ? record.videoId : extractVideoId(record.url);
          return {
            item: { ...record, videoId },
            score: scoreVideoCandidate({
              title: record.title,
              author: record.uploaderName || record.uploader,
              lengthSeconds: record.duration || record.lengthSeconds,
            }, artist, title),
          };
        })
        .filter((entry) => entry.item.videoId)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      for (const entry of ranked) {
        if (entry?.item?.videoId) {
          candidates.push(entry.item as Record<string, unknown>);
        }
      }

      if (candidates.length >= 4) {
        return candidates;
      }
    } catch (error) {
      console.warn(`Piped search failed: ${instance}`, error);
    }
  }

  return candidates;
}

function pickBestStream(data: Record<string, any>, instance: string) {
  const adaptiveFormats = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : [];
  const audioFormats = adaptiveFormats
    .filter((format) => format.type?.startsWith('audio/'))
    .sort((a, b) => {
      const aMp4 = a.type?.includes('mp4') || a.container === 'm4a';
      const bMp4 = b.type?.includes('mp4') || b.container === 'm4a';
      if (aMp4 && !bMp4) return -1;
      if (!aMp4 && bMp4) return 1;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  const chosen = audioFormats[0] || (Array.isArray(data.formatStreams) ? data.formatStreams[0] : null);
  return normalizeExternalUrl(chosen?.url, instance);
}

function pickBestPipedStream(data: Record<string, any>, instance: string) {
  const audioStreams = Array.isArray(data.audioStreams) ? data.audioStreams : [];
  const preferred = audioStreams
    .filter((stream) => typeof stream?.url === 'string')
    .sort((a, b) => {
      const aMp4 = a.mimeType?.includes('mp4') || a.format === 'm4a';
      const bMp4 = b.mimeType?.includes('mp4') || b.format === 'm4a';
      if (aMp4 && !bMp4) return -1;
      if (!aMp4 && bMp4) return 1;
      return (b.bitrate || 0) - (a.bitrate || 0);
    })[0];

  return normalizeExternalUrl(preferred?.url, instance);
}

async function resolveStream(artist: string, title: string): Promise<ResolveResult> {
  const cacheKey = `resolve:${artist}:${title}`;
  const cached = getCached<ResolveResult>(cacheKey);
  if (cached) return cached;

  const rankedCandidates = [...await searchInvidious(artist, title), ...await searchPiped(artist, title)]
    .filter((candidate) => candidate?.videoId)
    .filter((candidate, index, all) => index === all.findIndex((entry) => entry.videoId === candidate.videoId))
    .slice(0, 8);

  if (!rankedCandidates.length) {
    return { success: false, error: 'Could not find a playable stream for this track' };
  }

  for (const candidate of rankedCandidates) {
    const videoId = String(candidate.videoId);

    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const data = await fetchJson(`${instance}/api/v1/videos/${videoId}`, 9000);
        const streamUrl = pickBestStream(data, instance);

        if (streamUrl) {
          const result: ResolveResult = {
            success: true,
            streamUrl,
            videoId,
            duration: Number(data.lengthSeconds || candidate.lengthSeconds || candidate.duration || 0) || undefined,
            title: title,
            artist: artist,
          };
          setCached(cacheKey, result, 10 * 60 * 1000);
          return result;
        }
      } catch (error) {
        console.warn(`Resolve instance failed: ${instance}`, error);
      }
    }

    for (const instance of PIPED_INSTANCES) {
      try {
        const data = await fetchJson(`${instance}/streams/${videoId}`, 9000);
        const streamUrl = pickBestPipedStream(data, instance);

        if (streamUrl) {
          const result: ResolveResult = {
            success: true,
            streamUrl,
            videoId,
            duration: Number(data.duration || candidate.lengthSeconds || candidate.duration || 0) || undefined,
            title: title,
            artist: artist,
          };
          setCached(cacheKey, result, 10 * 60 * 1000);
          return result;
        }
      } catch (error) {
        console.warn(`Resolve piped instance failed: ${instance}`, error);
      }
    }
  }

  return { success: false, error: 'All stream sources are currently unavailable' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    if (!LASTFM_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Last.fm is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 2) {
        return new Response(JSON.stringify({ success: false, error: 'Search query must be at least 2 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = await searchLastFm(query, 12);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'top') {
      const requestedLimit = typeof body.limit === 'number' ? body.limit : 20;
      const limit = Math.max(1, Math.min(20, requestedLimit));
      const results = await getTopTracks(limit);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resolve') {
      const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
      const title = typeof body.title === 'string' ? body.title.trim() : '';

      if (!artist || !title) {
        return new Response(JSON.stringify({ success: false, error: 'Artist and title are required to resolve a stream' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await resolveStream(artist, title);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unsupported action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('music-indexer error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});