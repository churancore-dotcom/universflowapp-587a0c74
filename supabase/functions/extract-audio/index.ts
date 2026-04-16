import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Piped instances (community-run YouTube proxies)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.private.coffee',
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.protokolla.fi',
  'https://invidious.jing.rocks',
  'https://iv.nboez.cc',
  'https://invidious.slipfox.xyz',
];

interface ExtractionResult {
  success: boolean;
  audioUrl?: string;
  title?: string;
  artist?: string;
  thumbnail?: string;
  duration?: number;
  platform?: string;
  error?: string;
  hint?: string;
}

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  const cleanUrl = url.trim();
  
  try {
    const urlObj = new URL(cleanUrl);
    const vParam = urlObj.searchParams.get('v');
    if (vParam && vParam.length === 11) {
      return vParam;
    }
  } catch {
    // Not a valid URL
  }

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function isPlaylistUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hasPlaylist = urlObj.searchParams.has('list');
    const hasVideo = urlObj.searchParams.has('v');
    return hasPlaylist && !hasVideo && url.includes('playlist');
  } catch {
    return false;
  }
}

// Try a Piped instance
async function tryPipedInstance(apiUrl: string, videoId: string): Promise<ExtractionResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${apiUrl}/streams/${videoId}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  ✗ ${new URL(apiUrl).hostname}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error || data.message) {
      console.log(`  ✗ ${new URL(apiUrl).hostname}: ${data.error || data.message}`);
      return null;
    }

    if (!data.audioStreams || data.audioStreams.length === 0) {
      console.log(`  ✗ ${new URL(apiUrl).hostname}: No audio streams`);
      return null;
    }

    // Sort audio streams by bitrate (highest first), prefer m4a
    const sortedStreams = [...data.audioStreams].sort((a: any, b: any) => {
      const aIsM4a = a.mimeType?.includes('mp4') || a.format === 'm4a';
      const bIsM4a = b.mimeType?.includes('mp4') || b.format === 'm4a';
      if (aIsM4a && !bIsM4a) return -1;
      if (!aIsM4a && bIsM4a) return 1;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

    const bestStream = sortedStreams[0];
    console.log(`  ✓ ${new URL(apiUrl).hostname}: ${bestStream.quality} ${Math.round(bestStream.bitrate / 1000)}kbps`);

    return {
      success: true,
      audioUrl: bestStream.url,
      title: data.title,
      artist: data.uploader,
      thumbnail: data.thumbnailUrl,
      duration: data.duration,
      platform: 'YouTube',
    };

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as Error;
    const msg = err.name === 'AbortError' ? 'Timeout' : (err.message?.substring(0, 40) || 'Error');
    console.log(`  ✗ ${new URL(apiUrl).hostname}: ${msg}`);
    return null;
  }
}

// Try an Invidious instance
async function tryInvidiousInstance(apiUrl: string, videoId: string): Promise<ExtractionResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/videos/${videoId}`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  ✗ [INV] ${new URL(apiUrl).hostname}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.log(`  ✗ [INV] ${new URL(apiUrl).hostname}: ${data.error}`);
      return null;
    }

    if (!data.adaptiveFormats || data.adaptiveFormats.length === 0) {
      console.log(`  ✗ [INV] ${new URL(apiUrl).hostname}: No adaptive formats`);
      return null;
    }

    // Filter to audio-only formats
    const audioFormats = data.adaptiveFormats.filter((f: any) => 
      f.type?.startsWith('audio/') || f.encoding === 'opus' || f.encoding === 'aac'
    );

    if (audioFormats.length === 0) {
      console.log(`  ✗ [INV] ${new URL(apiUrl).hostname}: No audio formats`);
      return null;
    }

    // Sort by bitrate, prefer m4a/aac
    const sortedFormats = [...audioFormats].sort((a: any, b: any) => {
      const aIsM4a = a.type?.includes('mp4') || a.container === 'm4a';
      const bIsM4a = b.type?.includes('mp4') || b.container === 'm4a';
      if (aIsM4a && !bIsM4a) return -1;
      if (!aIsM4a && bIsM4a) return 1;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

    const bestFormat = sortedFormats[0];
    const bitrate = bestFormat.bitrate ? Math.round(bestFormat.bitrate / 1000) : 'N/A';
    console.log(`  ✓ [INV] ${new URL(apiUrl).hostname}: ${bestFormat.encoding || 'audio'} ${bitrate}kbps`);

    // Get best thumbnail
    let thumbnail = '';
    if (data.videoThumbnails && data.videoThumbnails.length > 0) {
      const maxresThumbnail = data.videoThumbnails.find((t: any) => t.quality === 'maxres');
      thumbnail = maxresThumbnail?.url || data.videoThumbnails[0]?.url || '';
    }

    return {
      success: true,
      audioUrl: bestFormat.url,
      title: data.title,
      artist: data.author,
      thumbnail: thumbnail,
      duration: data.lengthSeconds,
      platform: 'YouTube',
    };

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as Error;
    const msg = err.name === 'AbortError' ? 'Timeout' : (err.message?.substring(0, 40) || 'Error');
    console.log(`  ✗ [INV] ${new URL(apiUrl).hostname}: ${msg}`);
    return null;
  }
}

// Main extraction function - tries Piped first, then Invidious as fallback
async function extractFromYouTube(videoId: string): Promise<ExtractionResult> {
  console.log(`\n=== Extracting YouTube video: ${videoId} ===`);
  
  // Shuffle instances for load distribution
  const pipedInstances = [...PIPED_INSTANCES].sort(() => Math.random() - 0.5);
  const invidiousInstances = [...INVIDIOUS_INSTANCES].sort(() => Math.random() - 0.5);
  
  // Try Piped instances first (batches of 6)
  console.log(`\nTrying ${pipedInstances.length} Piped instances...`);
  for (let i = 0; i < pipedInstances.length; i += 6) {
    const batch = pipedInstances.slice(i, i + 6);
    console.log(`Piped Batch ${Math.floor(i/6) + 1}:`);
    
    const results = await Promise.all(
      batch.map(instance => tryPipedInstance(instance, videoId))
    );

    const success = results.find(r => r?.success);
    if (success) {
      return success;
    }
  }
  
  // Fallback to Invidious instances (batches of 5)
  console.log(`\nPiped failed. Trying ${invidiousInstances.length} Invidious instances...`);
  for (let i = 0; i < invidiousInstances.length; i += 5) {
    const batch = invidiousInstances.slice(i, i + 5);
    console.log(`Invidious Batch ${Math.floor(i/5) + 1}:`);
    
    const results = await Promise.all(
      batch.map(instance => tryInvidiousInstance(instance, videoId))
    );

    const success = results.find(r => r?.success);
    if (success) {
      return success;
    }
  }

  return {
    success: false,
    error: 'Could not extract audio. All servers are busy or the video is unavailable.',
    hint: 'Try again in a moment. Some videos may be geo-restricted or age-gated.',
    platform: 'YouTube',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${claimsData.user.id}`);

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('\n========================================');
    console.log('Extracting from URL:', url);

    // Direct audio URL
    if (url.match(/\.(mp3|wav|flac|aac|ogg|m4a|opus|webm)(\?.*)?$/i)) {
      console.log('Direct audio URL detected');
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: url,
          platform: 'Direct Link',
          title: url.split('/').pop()?.split('?')[0] || 'audio',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Playlist URL check
    if (isPlaylistUrl(url)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Playlist URLs are not supported. Please copy a specific video link.',
          hint: 'Click on a video in the playlist, then copy its URL.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Platform detection
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube.com');

    if (!isYouTube) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Currently only YouTube URLs are supported.',
          hint: 'Paste a YouTube video URL (youtube.com/watch?v=... or youtu.be/...)',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    console.log('Video ID:', videoId);

    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Could not extract video ID from URL.',
          hint: 'Please use a direct video URL like youtube.com/watch?v=VIDEO_ID',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract audio
    const result = await extractFromYouTube(videoId);

    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('\n========================================');
    console.log('✓ EXTRACTION SUCCESSFUL');
    console.log('Title:', result.title);
    console.log('Artist:', result.artist);
    console.log('Duration:', result.duration, 'seconds');
    console.log('========================================\n');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const err = error as Error;
    return new Response(
      JSON.stringify({ 
        success: false,
        error: err.message || 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});