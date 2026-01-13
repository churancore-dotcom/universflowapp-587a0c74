import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Cache for like states to reduce DB calls
const likeCache = new Map<string, boolean>();

export const useLike = (songId: string) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(() => likeCache.get(`${user?.id}-${songId}`) ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (user && songId) {
      const cacheKey = `${user.id}-${songId}`;
      if (likeCache.has(cacheKey)) {
        setIsLiked(likeCache.get(cacheKey)!);
      } else {
        checkIfLiked();
      }
    }
  }, [user?.id, songId]);

  const checkIfLiked = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_library')
      .select('id')
      .eq('user_id', user.id)
      .eq('song_id', songId)
      .maybeSingle();

    const liked = !!data;
    likeCache.set(`${user.id}-${songId}`, liked);
    if (mountedRef.current) {
      setIsLiked(liked);
    }
  };

  const toggleLike = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to like songs');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    // Optimistic update
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    likeCache.set(`${user.id}-${songId}`, newLiked);

    try {
      if (!newLiked) {
        // Unlike
        const { error } = await supabase
          .from('user_library')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);

        if (error) throw error;
        toast.success('Removed from library');
      } else {
        // Like
        const { error } = await supabase
          .from('user_library')
          .insert({ user_id: user.id, song_id: songId });

        if (error) throw error;
        toast.success('Added to library ❤️');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Rollback on error
      setIsLiked(!newLiked);
      likeCache.set(`${user.id}-${songId}`, !newLiked);
      toast.error('Failed to update library');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user, songId, isLiked, isLoading]);

  return { isLiked, isLoading, toggleLike };
};

export const useRecentlyPlayed = () => {
  const { user } = useAuth();

  const trackPlay = useCallback(async (songId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('recently_played')
        .insert({ user_id: user.id, song_id: songId });
    } catch (error) {
      // Silent fail
    }
  }, [user]);

  return { trackPlay };
};
