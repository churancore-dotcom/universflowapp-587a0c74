import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, genre, limit = 25, index = 0 } = await req.json();

    let url = '';

    switch (action) {
      case 'search':
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Query is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&index=${index}`;
        break;

      case 'chart':
        // Top tracks globally
        url = `https://api.deezer.com/chart/0/tracks?limit=${limit}&index=${index}`;
        break;

      case 'genre_artists':
        // Get top artists for a genre, then their top tracks
        const genreId = genre || '0';
        url = `https://api.deezer.com/chart/${genreId}/tracks?limit=${limit}&index=${index}`;
        break;

      case 'artist_top':
        // Get top tracks of a specific artist
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Artist ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.deezer.com/artist/${query}/top?limit=${limit}`;
        break;

      case 'playlist':
        // Fetch a Deezer editorial playlist
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Playlist ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `https://api.deezer.com/playlist/${query}/tracks?limit=${limit}&index=${index}`;
        break;

      case 'track_genre':
        // Get genre for a specific track via its album
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Album ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        try {
          const albumRes = await fetch(`https://api.deezer.com/album/${query}`);
          if (albumRes.ok) {
            const albumData = await albumRes.json();
            const genres = albumData.genres?.data?.map((g: any) => g.name) || [];
            return new Response(
              JSON.stringify({ genre: genres[0] || null, genres }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (e) {
          console.error('Genre lookup failed:', e);
        }
        return new Response(
          JSON.stringify({ genre: null, genres: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: search, chart, genre_artists, artist_top, playlist' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('Deezer API call:', url);
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Deezer API error:', response.status, errText);
      return new Response(
        JSON.stringify({ error: `Deezer API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // Normalize response
    const tracks = (data.data || []).map((track: any) => ({
      deezer_id: track.id,
      title: track.title || track.title_short || 'Unknown',
      artist: track.artist?.name || 'Unknown Artist',
      artist_id: track.artist?.id,
      album: track.album?.title || null,
      duration: track.duration || null,
      cover_url: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || null,
      preview_url: track.preview || null, // 30s preview (not used for import)
      rank: track.rank || 0,
    }));

    return new Response(
      JSON.stringify({
        tracks,
        total: data.total || tracks.length,
        next: data.next || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Deezer search error:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ error: err.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
