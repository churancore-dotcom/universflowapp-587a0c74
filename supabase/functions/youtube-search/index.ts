import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Piped instances for searching (NO API key needed, unlimited, free)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.moomoo.me',
  'https://piped-api.lunar.icu',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Decode HTML entities
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

async function searchPiped(query: string, instance: string, filter: string): Promise<any[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=${filter}`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      await resp.text();
      return null;
    }

    const data = await resp.json();
    const items = data.items || [];

    return items
      .filter((item: any) => item.url && item.type === 'stream')
      .map((item: any) => {
        // Extract videoId from /watch?v=XXXXX
        const match = item.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        const videoId = match ? match[1] : '';
        return {
          videoId,
          title: decodeEntities(item.title || ''),
          channelTitle: decodeEntities(item.uploaderName || item.uploader || ''),
          thumbnail: item.thumbnail || '',
          duration: item.duration || 0,
        };
      })
      .filter((r: any) => r.videoId);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, maxResults = 20 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchQuery = query.trim();
    const filter = 'music_songs'; // Piped music filter

    // Try Piped instances (no API key needed!)
    const instances = shuffle(PIPED_INSTANCES);
    for (const instance of instances) {
      console.log(`Trying Piped search: ${instance}`);
      const results = await searchPiped(searchQuery, instance, filter);
      if (results && results.length > 0) {
        const limited = results.slice(0, Math.min(maxResults, 50));
        console.log(`✓ Found ${limited.length} results via ${instance}`);
        return new Response(JSON.stringify({
          success: true,
          results: limited,
          totalResults: limited.length,
          query: searchQuery,
          source: 'piped',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fallback: try with 'videos' filter instead of 'music_songs'
    for (const instance of instances) {
      console.log(`Fallback search (videos filter): ${instance}`);
      const results = await searchPiped(searchQuery, instance, 'videos');
      if (results && results.length > 0) {
        const limited = results.slice(0, Math.min(maxResults, 50));
        console.log(`✓ Fallback found ${limited.length} results via ${instance}`);
        return new Response(JSON.stringify({
          success: true,
          results: limited,
          totalResults: limited.length,
          query: searchQuery,
          source: 'piped-fallback',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'No results found. All search providers are temporarily unavailable.',
      results: [],
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('youtube-search error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
