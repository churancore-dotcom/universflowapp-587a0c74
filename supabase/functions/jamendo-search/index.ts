import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('JAMENDO_CLIENT_ID');
    if (!clientId) {
      throw new Error('JAMENDO_CLIENT_ID is not configured');
    }

    const { action, query, genre, limit = 20, offset = 0, order = 'popularity_total' } = await req.json();

    let url: string;

    if (action === 'search') {
      const params = new URLSearchParams({
        client_id: clientId,
        format: 'json',
        limit: String(Math.min(limit, 200)),
        offset: String(offset),
        include: 'musicinfo',
        audioformat: 'mp32',
        order: order,
      });
      if (query) params.set('search', query);
      if (genre) {
        // Support multi-tag search like "indian+bollywood+hindi"
        const tags = genre.replace(/\+/g, ' ');
        params.set('tags', tags);
      }
      url = `https://api.jamendo.com/v3.0/tracks/?${params}`;
    } else if (action === 'genres') {
      const genres = [
        'pop', 'rock', 'electronic', 'hiphop', 'phonk', 'indian', 'bollywood',
        'punjabi', 'jazz', 'classical', 'ambient', 'blues', 'country', 'folk',
        'funk', 'latin', 'metal', 'punk', 'reggae', 'rnb', 'soul', 'world',
        'soundtrack', 'lounge', 'indie', 'dance', 'trap'
      ];
      return new Response(JSON.stringify({ genres }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'popular' || action === 'bulk_genre') {
      const fetchLimit = Math.min(limit, 200);
      const params = new URLSearchParams({
        client_id: clientId,
        format: 'json',
        limit: String(fetchLimit),
        offset: String(offset),
        include: 'musicinfo',
        audioformat: 'mp32',
        order: order || 'popularity_total',
        boost: 'popularity_total',
      });
      if (genre) {
        const tags = genre.replace(/\+/g, ' ');
        params.set('tags', tags);
      }
      url = `https://api.jamendo.com/v3.0/tracks/?${params}`;
    } else {
      throw new Error('Invalid action');
    }

    const response = await fetch(url);
    const data = await response.json();

    // Map Jamendo response to our format
    const tracks = (data.results || []).map((t: any) => ({
      jamendo_id: t.id,
      title: t.name,
      artist: t.artist_name,
      artist_id: t.artist_id,
      album: t.album_name || null,
      duration: t.duration ? Number(t.duration) : null,
      audio_url: t.audio || t.audiodownload || '',
      cover_url: t.album_image || t.image || null,
      genre: t.musicinfo?.tags?.genres?.[0] || genre || null,
      mood: t.musicinfo?.tags?.vartags?.[0] || null,
      license: t.license_ccurl || 'Creative Commons',
    }));

    return new Response(JSON.stringify({ tracks, total: data.headers?.results_count || tracks.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Jamendo search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
