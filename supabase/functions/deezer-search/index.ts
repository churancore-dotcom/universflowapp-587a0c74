import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INVIDIOUS_SEARCH_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.privacyredirect.com",
  "https://yt.artemislena.eu",
  "https://invidious.perennialte.ch",
];

const normalizeTracks = (data: any) =>
  (data.data || []).map((track: any) => ({
    deezer_id: track.id,
    title: track.title || track.title_short || "Unknown",
    artist: track.artist?.name || "Unknown Artist",
    artist_id: track.artist?.id,
    album: track.album?.title || null,
    album_id: track.album?.id || null,
    duration: track.duration || null,
    cover_url: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || null,
    preview_url: track.preview || null,
    rank: track.rank || 0,
  }));

const buildSearchQueries = (rawQuery: string): string[] => {
  const original = rawQuery.trim();
  if (!original) return [];

  const cleaned = original
    .replace(/\b(20\d{2}|latest|new|hits?|viral|top|best|songs?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const querySet = new Set<string>([original]);
  if (cleaned && cleaned !== original) querySet.add(cleaned);

  if (/bollywood|hindi|indian/i.test(original)) {
    querySet.add("bollywood");
    querySet.add("hindi songs");
  }

  if (/punjabi/i.test(original)) querySet.add("punjabi songs");
  if (/phonk/i.test(original)) querySet.add("phonk");
  if (/hip\s?hop|rap/i.test(original)) querySet.add("hip hop");

  return Array.from(querySet);
};

const searchYouTubeByQuery = async (searchQuery: string) => {
  // Primary: parse YouTube search HTML directly (most reliable)
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(ytUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.ok) {
      const html = await response.text();
      const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (videoIdMatch?.[1]) {
        const videoId = videoIdMatch[1];
        return {
          videoId,
          title: null,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          source: "youtube-web",
        };
      }
    }
  } catch (error) {
    console.error("YouTube HTML search failed:", error);
  }

  // Fallback: Invidious instances
  for (const instance of INVIDIOUS_SEARCH_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=relevance`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const firstVideo = rows.find((row: any) => row?.videoId);
      if (!firstVideo?.videoId) continue;

      const thumbnail =
        firstVideo.videoThumbnails?.find((t: any) => t?.quality === "maxresdefault")?.url ||
        firstVideo.videoThumbnails?.[0]?.url ||
        null;

      return {
        videoId: firstVideo.videoId,
        title: firstVideo.title || null,
        thumbnail,
        source: instance,
      };
    } catch (error) {
      console.error(`YouTube search failed on ${instance}:`, error);
    }
  }

  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, genre, limit = 25, index = 0 } = await req.json();

    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
    const safeIndex = Math.max(Number(index) || 0, 0);

    let url = "";

    switch (action) {
      case "search": {
        if (!query) {
          return new Response(JSON.stringify({ error: "Query is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const attempts = buildSearchQueries(String(query));

        for (const attemptedQuery of attempts) {
          const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(attemptedQuery)}&limit=${safeLimit}&index=${safeIndex}`;
          console.log("Deezer API search attempt:", searchUrl);

          const response = await fetch(searchUrl);
          if (!response.ok) continue;

          const data = await response.json();
          const tracks = normalizeTracks(data);

          if (tracks.length > 0 || attemptedQuery === attempts[attempts.length - 1]) {
            return new Response(
              JSON.stringify({
                tracks,
                total: data.total || tracks.length,
                next: data.next || null,
                search_used: attemptedQuery,
                search_attempts: attempts,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ tracks: [], total: 0, next: null, search_used: null, search_attempts: attempts }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "youtube_search": {
        if (!query) {
          return new Response(JSON.stringify({ error: "YouTube query is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result = await searchYouTubeByQuery(String(query));
        if (!result) {
          return new Response(JSON.stringify({ error: "Could not find song on YouTube" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "chart":
        url = `https://api.deezer.com/chart/0/tracks?limit=${safeLimit}&index=${safeIndex}`;
        break;

      case "genre_artists": {
        const genreId = genre || "0";
        url = `https://api.deezer.com/chart/${genreId}/tracks?limit=${safeLimit}&index=${safeIndex}`;
        break;
      }

      case "artist_top":
        if (!query) {
          return new Response(JSON.stringify({ error: "Artist ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `https://api.deezer.com/artist/${query}/top?limit=${safeLimit}`;
        break;

      case "playlist":
        if (!query) {
          return new Response(JSON.stringify({ error: "Playlist ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `https://api.deezer.com/playlist/${query}/tracks?limit=${safeLimit}&index=${safeIndex}`;
        break;

      case "track_genre":
        if (!query) {
          return new Response(JSON.stringify({ error: "Album ID required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          const albumRes = await fetch(`https://api.deezer.com/album/${query}`);
          if (albumRes.ok) {
            const albumData = await albumRes.json();
            const genres = albumData.genres?.data?.map((g: any) => g.name) || [];
            return new Response(JSON.stringify({ genre: genres[0] || null, genres }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          console.error("Genre lookup failed:", e);
        }
        return new Response(JSON.stringify({ genre: null, genres: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: search, youtube_search, chart, genre_artists, artist_top, playlist, track_genre" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("Deezer API call:", url);
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Deezer API error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Deezer API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const tracks = normalizeTracks(data);

    return new Response(
      JSON.stringify({
        tracks,
        total: data.total || tracks.length,
        next: data.next || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Deezer search error:", error);
    const err = error as Error;
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});