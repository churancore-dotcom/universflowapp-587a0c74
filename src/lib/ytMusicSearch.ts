/**
 * YouTube Music search & stream resolver via public Invidious instances.
 * No API key needed — fully open-source pipeline.
 */

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://invidious.protokolla.fi',
];

export interface YTMusicResult {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  cover_url?: string;
  duration?: number;
}

/** Clean up typical YouTube title junk */
function cleanTitle(raw: string): { title: string; artist: string } {
  let t = raw
    .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
    .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
    .replace(/\s*\(Official\s*Audio\)/gi, '')
    .replace(/\s*\[Official\s*Audio\]/gi, '')
    .replace(/\s*\(Lyrics?\)/gi, '')
    .replace(/\s*\[Lyrics?\]/gi, '')
    .replace(/\s*\(Visuali[sz]er\)/gi, '')
    .replace(/\s*\[Visuali[sz]er\]/gi, '')
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s*\/\/\s*.*$/, '')
    .trim();

  const dashMatch = t.match(/^(.+?)\s*[-–—]\s+(.+)$/);
  if (dashMatch) {
    return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
  }
  return { title: t, artist: '' };
}

/** Try fetching from an instance with timeout */
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Search via Invidious API */
async function searchInvidious(query: string, instance: string): Promise<YTMusicResult[]> {
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query + ' music')}&type=video&sort_by=relevance`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Invidious ${res.status}`);
  const items: any[] = await res.json();
  return items.slice(0, 20).map((item: any) => {
    const { title, artist: parsedArtist } = cleanTitle(item.title || '');
    const thumb = item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url
      || item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url
      || item.videoThumbnails?.[0]?.url;
    
    // Fix relative thumbnail URLs
    const cover_url = thumb?.startsWith('/') ? `${instance}${thumb}` : thumb;
    
    return {
      id: `ytm-${item.videoId}`,
      videoId: item.videoId,
      title,
      artist: parsedArtist || item.author || 'Unknown Artist',
      cover_url,
      duration: item.lengthSeconds || undefined,
    };
  }).filter((r: YTMusicResult) => r.videoId);
}

/** Track which instance worked last so we try it first */
let lastWorkingInstance = 0;

/** Main search — rotates through Invidious instances until one works */
export async function searchYTMusic(query: string): Promise<YTMusicResult[]> {
  const instances = [...INVIDIOUS_INSTANCES];
  // Put last working instance first
  if (lastWorkingInstance > 0 && lastWorkingInstance < instances.length) {
    const [best] = instances.splice(lastWorkingInstance, 1);
    instances.unshift(best);
  }

  for (let i = 0; i < instances.length; i++) {
    try {
      const results = await searchInvidious(query, instances[i]);
      if (results.length > 0) {
        lastWorkingInstance = INVIDIOUS_INSTANCES.indexOf(instances[i]);
        return results;
      }
    } catch (err) {
      console.warn(`Invidious instance ${instances[i]} failed:`, err);
    }
  }
  return [];
}

/** Resolve a direct audio stream URL for a video ID */
export async function resolveStreamUrl(videoId: string): Promise<string | null> {
  const instances = [...INVIDIOUS_INSTANCES];
  if (lastWorkingInstance > 0 && lastWorkingInstance < instances.length) {
    const [best] = instances.splice(lastWorkingInstance, 1);
    instances.unshift(best);
  }

  for (const inst of instances) {
    try {
      const res = await fetchWithTimeout(`${inst}/api/v1/videos/${videoId}`);
      if (!res.ok) continue;
      const data = await res.json();
      
      // Try adaptive formats first (audio only)
      const adaptiveFormats = data.adaptiveFormats || [];
      const audioFormats = adaptiveFormats
        .filter((f: any) => f.type?.startsWith('audio/'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      
      // Prefer m4a/mp4a, then opus/webm
      const m4a = audioFormats.find((f: any) => 
        f.type?.includes('mp4a') || f.type?.includes('audio/mp4')
      );
      const best = m4a || audioFormats[0];
      if (best?.url) return best.url;

      // Fallback: format streams (combined audio+video, pick lowest quality)
      const formatStreams = data.formatStreams || [];
      if (formatStreams.length > 0) {
        return formatStreams[0].url;
      }
    } catch (err) {
      console.warn(`Stream resolve failed for ${inst}:`, err);
    }
  }
  return null;
}

/** Convert a YTMusicResult to a Song-compatible object with resolved stream */
export function ytResultToSong(r: YTMusicResult, streamUrl: string) {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    cover_url: r.cover_url,
    audio_url: streamUrl,
    duration: r.duration,
  };
}
