import { supabase } from '@/integrations/supabase/client';
import type { Song } from '@/contexts/PlayerContext';
import { isCatalogSongId } from '@/lib/songSupport';

export interface PlaylistSongRow {
  id: string;
  song_id: string;
  position: number;
  track_source?: string;
}

export interface LibrarySongRow {
  id: string;
  song_id: string;
  added_at?: string;
  track_source?: string;
}

const songFromCatalog = (song: any): Song => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  album: song.album || undefined,
  cover_url: song.cover_url || undefined,
  audio_url: song.audio_url,
  duration: song.duration || undefined,
  artist_id: song.artist_id || undefined,
  artist_photo_url: song.artist_image_url || undefined,
  source: 'library',
});

const songFromStream = (song: any): Song => ({
  id: song.track_id,
  title: song.title,
  artist: song.artist,
  album: song.album || undefined,
  cover_url: song.cover_url || undefined,
  audio_url: song.audio_url || 'resolving',
  duration: song.duration || undefined,
  artist_photo_url: song.artist_image_url || undefined,
  source: song.source === 'audius' ? 'audius' : 'indexed',
});

export const getTrackSource = (song: Pick<Song, 'id' | 'source'>) => {
  if (song.source) return song.source;
  return isCatalogSongId(song.id) ? 'library' : 'indexed';
};

export const persistStreamSong = async (song: Song) => {
  if (!song?.id || isCatalogSongId(song.id)) return;

  await supabase.from('stream_songs').upsert({
    track_id: song.id,
    source: getTrackSource(song),
    title: song.title,
    artist: song.artist,
    album: song.album ?? null,
    cover_url: song.cover_url ?? null,
    audio_url: song.audio_url ?? null,
    duration: song.duration ?? null,
    artist_image_url: song.artist_photo_url ?? null,
    metadata: {},
    last_seen_at: new Date().toISOString(),
  });
};

export const loadLibrarySongs = async (userId: string) => {
  const { data: rows, error } = await supabase
    .from('user_library')
    .select('id, song_id, added_at, track_source')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error || !rows?.length) return [];

  const streamIds = rows.map((row) => row.song_id).filter((id) => !isCatalogSongId(id));

  const [streamRes] = await Promise.all([
    streamIds.length
      ? supabase.from('stream_songs').select('*').in('track_id', streamIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const streamMap = new Map((streamRes.data || []).map((song: any) => [song.track_id, songFromStream(song)]));

  return rows
    .map((row) => streamMap.get(row.song_id))
    .filter(Boolean) as Song[];
};

export const loadPlaylistSongs = async (playlistId: string) => {
  const { data: rows, error } = await supabase
    .from('playlist_songs')
    .select('id, song_id, position, track_source')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error || !rows?.length) return [];

  const streamIds = rows.map((row) => row.song_id).filter((id) => !isCatalogSongId(id));

  const [streamRes] = await Promise.all([
    streamIds.length
      ? supabase.from('stream_songs').select('*').in('track_id', streamIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const streamMap = new Map((streamRes.data || []).map((song: any) => [song.track_id, songFromStream(song)]));

  return rows
    .map((row) => {
      const song = streamMap.get(row.song_id);
      if (!song) return null;
      return { ...song, position: row.position, playlist_song_id: row.id };
    })
    .filter(Boolean);
};