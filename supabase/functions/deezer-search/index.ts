import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
          JSON.stringify({ error: "Invalid action. Use: search, chart, genre_artists, artist_top, playlist, track_genre" }),
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
