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
  error?: string;
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

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-indexer`;

async function requestIndexer<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    throw new Error(json?.error || `Request failed with status ${response.status}`);
  }

  return json as T;
}

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

export async function searchIndexedTracks(query: string): Promise<IndexedTrack[]> {
  const data = await requestIndexer<IndexedTracksResponse>({
    action: 'search',
    query,
  });

  return Array.isArray(data.results) ? data.results : [];
}

export async function getTopIndexedTracks(limit = 20): Promise<IndexedTrack[]> {
  const data = await requestIndexer<IndexedTracksResponse>({
    action: 'top',
    limit,
  });

  return Array.isArray(data.results) ? data.results : [];
}

export async function resolveIndexedTrack(artist: string, title: string) {
  try {
    return await requestIndexer<ResolveTrackResponse>({
      action: 'resolve',
      artist,
      title,
    });
  } catch (primaryError) {
    const fallback = await resolveViaYouTubeFallback(artist, title).catch(() => null);
    if (fallback?.streamUrl) {
      return fallback;
    }

    throw primaryError;
  }
}