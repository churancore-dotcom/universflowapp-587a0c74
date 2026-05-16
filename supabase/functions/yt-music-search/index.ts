import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  audio_url: string;
  cover_url?: string;
  duration?: number;
  published?: number;
}

async function persistSearchResults(adminClient: any, results: SearchResult[]) {
  if (!results.length) return;
  const now = new Date().toISOString();
  const rows = results.map((track) => ({
    track_id: track.id,
    source: 'indexed',
    title: track.title,
    artist: track.artist,
    cover_url: track.cover_url ?? null,
    audio_url: track.audio_url || `yt-video:${track.videoId}`,
    duration: track.duration ?? null,
    metadata: { provider: 'youtube', videoId: track.videoId },
    last_seen_at: now,
    updated_at: now,
  }));

  const { error } = await adminClient.from('stream_songs').upsert(rows, { onConflict: 'track_id' });
  if (error) console.warn('Unable to cache search results:', error.message);
}

const GENERIC_QUERY_WORDS = new Set([
  'song', 'songs', 'music', 'track', 'tracks', 'latest', 'new', 'fresh', 'official', 'audio', 'video',
  'hindi', 'bollywood', 'punjabi', 'tamil', 'telugu', 'bhojpuri', 'marathi', 'bengali', 'gujarati', 'malayalam', 'kannada', 'urdu',
  'sad', 'love', 'romantic', 'happy', 'party', 'dance', 'lofi', 'lo-fi', 'chill', 'workout', 'gym', 'rap', 'pop', 'rock'
]);

const SPAM_PATTERNS = [
  /\b(top|best)\s*\d+\b/i,
  /\b\d+\s*(top|best|hit|hits|songs)\b/i,
  /\b(non\s*stop|jukebox|mashup|medley|playlist|compilation|collection|mixtape|album full|full album|all songs)\b/i,
  /\b(90'?s|80'?s|70'?s|evergreen|old is gold|purane|old songs?)\b/i,
  /\b(sped up|slowed|reverb|nightcore|8d|karaoke|cover|remix|instrumental)\b/i,
  /\b\d+\s*(hour|hours|hr|hrs|minute|minutes|min)\b/i,
];

const normalize = (value = '') => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function meaningfulTokens(query: string) {
  return normalize(query)
    .split(' ')
    .filter((token) => token.length > 1 && !GENERIC_QUERY_WORDS.has(token));
}

// A query is "lyric-like" when the user typed a phrase (multiple words / long).
// In that case we trust YouTube/Invidious ranking — they index captions &
// descriptions, so the right video may not have the lyric in its title.
function isLyricQuery(query: string) {
  const raw = query.trim();
  const wordCount = raw.split(/\s+/).filter(Boolean).length;
  return wordCount >= 4 || raw.length >= 25;
}

function queryMatchesResult(item: any, query: string) {
  // For lyric-style queries, don't gate on title overlap.
  if (isLyricQuery(query)) return true;
  const tokens = meaningfulTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalize(`${String(item?.title || '')} ${String(item?.author || item?.channelTitle || '')}`);
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits > 0 && (tokens.length < 2 || hits / tokens.length >= 0.5);
}

function looksSpammy(item: any, query: string) {
  const rawTitle = String(item?.title || '');
  const rawAuthor = String(item?.author || '');
  const haystack = `${rawTitle} ${rawAuthor}`;
  const q = normalize(query);
  const duration = Number(item?.lengthSeconds || item?.duration || 0);

  if (duration && (duration < 75 || duration > 540)) return true;
  if (SPAM_PATTERNS.some((pattern) => pattern.test(haystack))) return true;
  if (!q.includes('lofi') && /\b(lofi|lo-fi)\b/i.test(haystack)) return true;
  return false;
}

function scoreResult(item: any, query: string, index: number) {
  const title = normalize(String(item?.title || ''));
  const author = normalize(String(item?.author || ''));
  const haystack = `${title} ${author}`;
  const q = normalize(query);
  const tokens = meaningfulTokens(query);
  const duration = Number(item?.lengthSeconds || item?.duration || 0);
  const published = Number(item?.published || 0);
  const ageDays = published > 0 ? Math.max(0, (Date.now() / 1000 - published) / 86400) : 9999;
  const lyric = isLyricQuery(query);
  let score = 100 - index;

  if (!queryMatchesResult(item, query)) return -999;

  if (q && haystack.includes(q)) score += 80;
  // For lyric queries, reward token hits but never penalize misses
  // (lyrics rarely appear in titles — trust provider ranking via 100 - index).
  score += tokens.reduce(
    (sum, token) => sum + (haystack.includes(token) ? 34 : lyric ? 0 : -28),
    0,
  );
  if (/\b(official audio|official video|music video|lyrics?|lyrical)\b/i.test(String(item?.title || ''))) score += 32;
  if (duration >= 120 && duration <= 360) score += 30;
  if (lyric) {
    // De-emphasize recency for lyric searches — user usually wants a specific song,
    // which may be old. Without this, old originals get buried under fresh covers.
    if (ageDays <= 365) score += 15;
  } else {
    if (ageDays <= 90) score += 55;
    else if (ageDays <= 365) score += 30;
    else score -= 80;
  }
  if (looksSpammy(item, query)) score -= 180;
  return score;
}


function cleanTitle(raw: string) {
  const cleaned = raw
    .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
    .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
    .replace(/\s*\(Official\s*Audio\)/gi, '')
    .replace(/\s*\[Official\s*Audio\]/gi, '')
    .replace(/\s*\(Lyrics?\)/gi, '')
    .replace(/\s*\[Lyrics?\]/gi, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();
  const dash = cleaned.match(/^(.+?)\s*[-–—]\s+(.+)$/);
  if (dash) return { artist: dash[1].trim(), title: dash[2].trim() };
  return { artist: '', title: cleaned };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Per-user rate limit (30 req/min) to protect YouTube quota
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: allowed } = await adminClient.rpc('check_and_increment_rate_limit', {
      _user_id: userData.user.id,
      _endpoint: 'yt-music-search',
      _max_per_minute: 30,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again in a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, limit: requestedLimit } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ success: false, error: 'A search query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const limit = Math.max(1, Math.min(50, typeof requestedLimit === 'number' ? requestedLimit : 30));

    // ---------- Try Invidious (Railway) FIRST for fresh results ----------
    const INVIDIOUS_INSTANCES = [
      'https://invidious-production-d29a.up.railway.app',
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://iv.datura.network',
      'https://invidious.privacyredirect.com',
    ];

    // sort_by: relevance | upload_date | view_count | rating
    // We pick upload_date when user prefixes "new:" else relevance, BUT bias to recent
    let sortBy = 'relevance';
    let cleanQuery = query.trim();
    if (cleanQuery.toLowerCase().startsWith('new:')) {
      sortBy = 'upload_date';
      cleanQuery = cleanQuery.slice(4).trim();
    }

    let invResults: SearchResult[] = [];
    const lyricMode = isLyricQuery(cleanQuery);
    // For lyric queries skip the "fresh year" window entirely — most lyric
    // searches target a specific older song.
    const dateWindows = lyricMode ? [''] : ['year', ''];
    // Append a query hint so YouTube/Invidious rank the right kind of video.
    const providerQuery = lyricMode ? `${cleanQuery} lyrics` : `${cleanQuery} music`;
    for (const dateWindow of dateWindows) {
      for (const inst of INVIDIOUS_INSTANCES) {
        try {
          const u = new URL(`${inst}/api/v1/search`);
          u.searchParams.set('q', providerQuery);
          u.searchParams.set('type', 'video');
          u.searchParams.set('sort_by', sortBy);
          if (dateWindow) u.searchParams.set('date', dateWindow);
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(u.toString(), { headers: { Accept: 'application/json' }, signal: ctrl.signal });
        clearTimeout(tm);
        if (!r.ok) continue;
        const items: any[] = await r.json();
        invResults = items
          .map((item: any, index: number) => ({ item, score: scoreResult(item, cleanQuery, index) }))
          .filter(({ item, score }: any) => item?.videoId && score > -20 && !looksSpammy(item, cleanQuery))
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, limit)
          .map((item: any) => {
            item = item.item;
            const videoId = item?.videoId;
            if (!videoId) return null;
            const parsed = cleanTitle(item.title || 'Unknown Title');
            const thumb = item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url
              || item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url
              || item.videoThumbnails?.[0]?.url;
            const cover_url = thumb?.startsWith('/') ? `${inst}${thumb}` : thumb;
            return {
              id: `ytm-${videoId}`,
              videoId,
              title: parsed.title,
              artist: parsed.artist || item.author || 'Unknown Artist',
              audio_url: `yt-video:${videoId}`,
              cover_url,
              duration: item.lengthSeconds || undefined,
              published: item.published || undefined,
            };
          })
          .filter(Boolean) as SearchResult[];
          if (invResults.length > 0) {
            console.log(`Invidious search OK via ${inst} (${dateWindow || 'all-time'}): ${invResults.length} results`);
            break;
          }
        } catch (e) {
          console.warn(`Invidious search failed on ${inst}:`, (e as Error).message);
        }
      }
      if (invResults.length > 0) break;
    }

    if (invResults.length > 0) {
      await persistSearchResults(adminClient, invResults);
      return new Response(JSON.stringify({ success: true, results: invResults, source: 'invidious' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- Fallback: YouTube Data API ----------
    console.log('Invidious returned 0 results, falling back to YouTube Data API');
    const apiKeys = [
      Deno.env.get('YOUTUBE_API_KEY'),
      Deno.env.get('YOUTUBE_API_KEY_2'),
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'YouTube search service is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let data: any = null;
    let lastErr = '';
    // Lyric queries: skip the freshOnly pass entirely (most lyrics are older songs).
    const freshOnlyPasses = lyricMode ? [false] : [true, false];
    for (const freshOnly of freshOnlyPasses) {
      for (const apiKey of apiKeys) {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('q', providerQuery);
        url.searchParams.set('type', 'video');
        url.searchParams.set('videoCategoryId', '10');
        url.searchParams.set('maxResults', String(limit));
        url.searchParams.set('order', sortBy === 'upload_date' ? 'date' : 'relevance');
        if (freshOnly) url.searchParams.set('publishedAfter', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        if (response.ok) {
          const candidateData = await response.json();
          const hasMatch = (candidateData.items || []).some((item: any) => queryMatchesResult({ title: item?.snippet?.title, author: item?.snippet?.channelTitle }, cleanQuery));
          if (hasMatch || !freshOnly) {
            data = candidateData;
            break;
          }
          lastErr = 'No matching fresh videos';
          continue;
        }
        lastErr = await response.text().catch(() => 'No matching videos');
        console.warn(`YouTube key/search window failed (${response.status}), trying next...`, lastErr.slice(0, 200));
      }
      if (data) break;
    }

    if (!data) {
      console.error('All YouTube keys failed:', lastErr);
      return new Response(JSON.stringify({ success: false, error: 'YouTube search is temporarily unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: SearchResult[] = (data.items || [])
      .map((item: any, index: number) => {
        const videoId = item?.id?.videoId;
        if (!videoId) return null;
        const snippet = item.snippet || {};
        const comparable = {
          videoId,
          title: snippet.title || '',
          author: snippet.channelTitle || '',
          published: snippet.publishedAt ? Math.floor(new Date(snippet.publishedAt).getTime() / 1000) : 0,
        };
        if (looksSpammy(comparable, cleanQuery) || scoreResult(comparable, cleanQuery, index) <= -20) return null;
        const parsed = cleanTitle(snippet.title || 'Unknown Title');
        return {
          id: `ytm-${videoId}`,
          videoId,
          title: parsed.title,
          artist: parsed.artist || snippet.channelTitle || 'Unknown Artist',
          audio_url: `yt-video:${videoId}`,
          cover_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
          published: comparable.published || undefined,
        };
      })
      .filter(Boolean);

    await persistSearchResults(adminClient, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('yt-music-search error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});