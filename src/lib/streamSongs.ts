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

export const hydratePlaylistCoverUrls = async <T extends { id: string; cover_url?: string | null }>(playlists: T[]): Promise<T[]> => {
  const ids = playlists.map((playlist) => playlist.id);
  if (ids.length === 0) return playlists;

  const { data: rows } = await supabase
    .from('playlist_songs')
    .select('playlist_id, song_id, position, track_source')
    .in('playlist_id', ids)
    .order('position', { ascending: true });

  if (!rows?.length) return playlists;

  const catalogIds = rows
    .filter((row: any) => row.track_source === 'library' || isCatalogSongId(row.song_id))
    .map((row: any) => row.song_id);
  const streamIds = rows
    .filter((row: any) => row.track_source !== 'library' && !isCatalogSongId(row.song_id))
    .map((row: any) => row.song_id);

  const [catalogRes, streamRes] = await Promise.all([
    catalogIds.length
      ? supabase.from('songs').select('id, cover_url').in('id', catalogIds)
      : Promise.resolve({ data: [] as any[] }),
    streamIds.length
      ? supabase.from('stream_songs').select('track_id, cover_url').in('track_id', streamIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const coverBySongId = new Map<string, string>();
  (catalogRes.data || []).forEach((song: any) => song.cover_url && coverBySongId.set(song.id, song.cover_url));
  (streamRes.data || []).forEach((song: any) => song.cover_url && coverBySongId.set(song.track_id, song.cover_url));

  // Collect up to 3 distinct artworks per playlist (in song order) for stacked cover
  const coversByPlaylistId = new Map<string, string[]>();
  rows.forEach((row: any) => {
    const cover = coverBySongId.get(row.song_id);
    if (!cover) return;
    const list = coversByPlaylistId.get(row.playlist_id) || [];
    if (list.length >= 3 || list.includes(cover)) return;
    list.push(cover);
    coversByPlaylistId.set(row.playlist_id, list);
  });

  return playlists.map((playlist) => {
    const stack = coversByPlaylistId.get(playlist.id) || [];
    return {
      ...playlist,
      cover_url: playlist.cover_url || stack[0] || null,
      cover_urls: stack,
    } as T & { cover_urls: string[] };
  });
};

export const loadPlaylistSongs = async (playlistId: string) => {
  const { data: rows, error } = await supabase
    .from('playlist_songs')
    .select('id, song_id, position, track_source')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error || !rows?.length) return [];

  const catalogIds = rows
    .filter((row: any) => row.track_source === 'library' || isCatalogSongId(row.song_id))
    .map((row: any) => row.song_id);
  const streamIds = rows
    .filter((row: any) => row.track_source !== 'library' && !isCatalogSongId(row.song_id))
    .map((row: any) => row.song_id);

  const [catalogRes, streamRes] = await Promise.all([
    catalogIds.length
      ? supabase.from('songs').select('*').in('id', catalogIds)
      : Promise.resolve({ data: [] as any[] }),
    streamIds.length
      ? supabase.from('stream_songs').select('*').in('track_id', streamIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const catalogMap = new Map((catalogRes.data || []).map((song: any) => [song.id, songFromCatalog(song)]));
  const streamMap = new Map((streamRes.data || []).map((song: any) => [song.track_id, songFromStream(song)]));

  return rows
    .map((row) => {
      const song = (row.track_source === 'library' || isCatalogSongId(row.song_id))
        ? catalogMap.get(row.song_id)
        : streamMap.get(row.song_id);
      if (!song) return null;
      return { ...song, position: row.position, playlist_song_id: row.id };
    })
    .filter(Boolean);
};