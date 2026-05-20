import type { IndexedTrack } from './musicIndexer';

const API = 'https://jiosaavn-api.universflow.workers.dev';

const cache = new Map<string, any>();

export async function searchSongs(query: string, limit = 20) {
  try {
    const res = await fetch(
      `${API}/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    const data = await res.json();
    return data.data?.results ?? [];
  } catch {
    return [];
  }
}

function decodeEntities(value = ''): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function bestImage(images: any): string | undefined {
  if (!images) return undefined;
  if (typeof images === 'string') return images;
  if (Array.isArray(images)) {
    const last = images[images.length - 1];
    return last?.url || last?.link;
  }
  return undefined;
}

function bestAudio(downloadUrl: any): string | undefined {
  if (!downloadUrl) return undefined;
  if (typeof downloadUrl === 'string') return downloadUrl;
  if (Array.isArray(downloadUrl)) {
    const hi = downloadUrl.find((u: any) => u.quality === '320kbps')
      || downloadUrl.find((u: any) => u.quality === '160kbps')
      || downloadUrl[downloadUrl.length - 1];
    return hi?.url || hi?.link;
  }
  return undefined;
}

function primaryArtists(song: any): string {
  const primary = song?.artists?.primary;
  if (Array.isArray(primary) && primary.length) {
    return primary.map((a: any) => a.name).filter(Boolean).join(', ');
  }
  if (typeof song?.primaryArtists === 'string') return song.primaryArtists;
  return song?.artist || '';
}

/**
 * Search JioSaavn and return results in IndexedTrack shape so the existing
 * Search UI and ranking code can consume them unchanged.
 */
export async function searchSongsAsTracks(query: string, limit = 30): Promise<IndexedTrack[]> {
  const results = await searchSongs(query, limit);
  return (results || [])
    .map((song: any): IndexedTrack | null => {
      if (!song?.id) return null;
      const audio = bestAudio(song.downloadUrl);
      return {
        id: `saavn-${song.id}`,
        title: decodeEntities(song.name || song.title || ''),
        artist: decodeEntities(primaryArtists(song)),
        album: decodeEntities(song.album?.name || song.album || ''),
        cover_url: bestImage(song.image),
        duration: typeof song.duration === 'number' ? song.duration : Number(song.duration) || undefined,
        audio_url: audio || 'resolving',
        listeners: typeof song.playCount === 'number' ? song.playCount : undefined,
      };
    })
    .filter((t): t is IndexedTrack => !!t && !!t.title && !!t.artist);
}

export async function getSongStreamUrl(songId: string) {
  // Strip our own prefix if caller forgot
  const id = songId.startsWith('saavn-') ? songId.slice(6) : songId;
  if (cache.has(id)) return cache.get(id);

  try {
    const res = await fetch(`${API}/api/songs/${id}`);
    const data = await res.json();
    const song = data.data?.[0] || data.data;
    if (!song) return null;

    const streamUrl = bestAudio(song.downloadUrl);
    if (!streamUrl) return null;

    const result = {
      streamUrl,
      id: song.id,
      title: decodeEntities(song.name || ''),
      artist: decodeEntities(primaryArtists(song)),
      album: decodeEntities(song.album?.name || ''),
      duration: song.duration,
      image: bestImage(song.image),
    };

    cache.set(id, result);
    if (cache.size > 60) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    return result;
  } catch {
    return null;
  }
}

export function prefetchSong(songId: string) {
  const id = songId.startsWith('saavn-') ? songId.slice(6) : songId;
  if (!cache.has(id)) getSongStreamUrl(id);
}

export function preloadNext(queue: any[], currentIndex: number) {
  const next = queue[currentIndex + 1];
  if (next?.id) prefetchSong(next.id);
}
