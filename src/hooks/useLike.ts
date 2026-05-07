import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isCatalogSongId } from '@/lib/songSupport';
import { persistStreamSong, getTrackSource } from '@/lib/streamSongs';
import type { Song } from '@/contexts/PlayerContext';

const LIBRARY_CACHE_KEY = 'library_cache_v1';

// ============================================================
// Batch Like Cache — single query loads ALL user likes
// For catalog songs: uses Supabase user_library
// For stream songs: uses localStorage
// ============================================================

let likeCache = new Set<string>();
let likeCacheLoaded = false;
let likeCacheUserId: string | null = null;
let likeCachePromise: Promise<void> | null = null;

const STREAM_LIKES_KEY = 'uf_stream_likes';

const getStreamLikes = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STREAM_LIKES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveStreamLikes = (likes: Set<string>) => {
  try {
    localStorage.setItem(STREAM_LIKES_KEY, JSON.stringify([...likes]));
  } catch { /* ignore */ }
};

const loadLikeCache = async (userId: string): Promise<void> => {
  if (likeCacheLoaded && likeCacheUserId === userId) return;
  if (likeCachePromise && likeCacheUserId === userId) return likeCachePromise;

  likeCacheUserId = userId;
  likeCachePromise = (async () => {
    const { data } = await supabase
      .from('user_library')
      .select('song_id')
      .eq('user_id', userId);

    likeCache = new Set(data?.map(d => d.song_id) || []);
    // Merge stream likes
    const streamLikes = getStreamLikes();
    for (const id of streamLikes) likeCache.add(id);
    likeCacheLoaded = true;
    likeCachePromise = null;
  })();

  return likeCachePromise;
};

export const useLike = (songId: string, song?: Song | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!songId) { setIsLiked(false); return; }

    if (!user) {
      const streamLikes = getStreamLikes();
      setIsLiked(streamLikes.has(songId));
      return;
    }

    const check = async () => {
      await loadLikeCache(user.id);
      if (mountedRef.current) {
        setIsLiked(likeCache.has(songId));
      }
    };
    check();
  }, [user?.id, songId]);

  const toggleLike = useCallback(async () => {
    if (!songId) return;

    if (!user) {
      toast.error('Please sign in to like songs');
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    const newLiked = !isLiked;

    setIsLiked(newLiked);
    if (newLiked) { likeCache.add(songId); } else { likeCache.delete(songId); }

    const isCatalog = isCatalogSongId(songId);

    try {
      if (newLiked) {
        if (!isCatalog && song) {
          await persistStreamSong(song);
        }
        const { error } = await supabase
          .from('user_library')
          .insert({
            user_id: user.id,
            song_id: songId,
            track_source: song ? getTrackSource(song) : (isCatalog ? 'library' : 'indexed'),
          });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('user_library')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);
        if (error) throw error;
      }

      if (!isCatalog) {
        const streamLikes = getStreamLikes();
        if (newLiked) streamLikes.add(songId); else streamLikes.delete(songId);
        saveStreamLikes(streamLikes);
      }

      // Bust both the persisted localStorage cache and the React Query cache
      // so Library reflects the change instantly (no zombie liked songs).
      try { localStorage.removeItem(`${LIBRARY_CACHE_KEY}:${user.id}`); } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ['library', user.id] });

      toast.success(newLiked ? 'Added to favorites ❤️' : 'Removed from favorites');
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiked(!newLiked);
      if (!newLiked) { likeCache.add(songId); } else { likeCache.delete(songId); }
      toast.error('Failed to update favorites');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user, songId, song, isLiked, isLoading, queryClient]);

  return { isLiked, isLoading, toggleLike };
};

export const useRecentlyPlayed = () => {
  const { user } = useAuth();

  const trackPlay = useCallback(async (songId: string) => {
    if (!user || !isCatalogSongId(songId)) return;

    try {
      await supabase
        .from('recently_played')
        .insert({ user_id: user.id, song_id: songId });
    } catch {
      // Silent fail
    }
  }, [user]);

  return { trackPlay };
};
