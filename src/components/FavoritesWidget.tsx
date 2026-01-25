import { useState, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Music, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { iosSpring, iosBounce } from '@/lib/animations';

function FavoritesWidgetComponent() {
  const { user } = useAuth();
  const { playSong, currentSong } = usePlayer();
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_library')
      .select('*, songs(*, artists(id, name, photo_url))')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .limit(5);

    if (data) {
      const songs = data.map(item => {
        const artistData = (item.songs as any)?.artists as { id: string; name: string; photo_url: string | null } | null;
        return {
          id: item.songs.id,
          title: item.songs.title,
          artist: item.songs.artist,
          album: item.songs.album || undefined,
          cover_url: item.songs.cover_url || undefined,
          audio_url: item.songs.audio_url,
          artist_id: artistData?.id || item.songs.artist_id || undefined,
          artist_photo_url: artistData?.photo_url || undefined,
        };
      });
      setFavorites(songs);
    }
    setLoading(false);
  };

  const handlePlayFavorite = useCallback((song: Song) => {
    playSong(song, undefined, favorites);
  }, [playSong, favorites]);

  if (loading || favorites.length === 0) return null;

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...iosSpring, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary" fill="currentColor" />
        <h2 className="text-lg font-bold">Your Favorites</h2>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {favorites.map((song, index) => {
          const isCurrentSong = currentSong?.id === song.id;
          
          return (
            <motion.button
              key={song.id}
              className="relative group"
              onClick={() => handlePlayFavorite(song)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...iosBounce, delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div 
                className={`aspect-square rounded-2xl overflow-hidden shadow-lg ${
                  isCurrentSong ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''
                }`}
              >
                {song.cover_url ? (
                  <img 
                    src={song.cover_url} 
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white/50" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Play className="w-4 h-4 text-black ml-0.5" fill="black" />
                  </div>
                </div>

                {isCurrentSong && (
                  <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-primary" />
                )}
              </div>

              <p className="mt-2 text-[11px] font-medium truncate text-center hidden sm:block">
                {song.title}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

const FavoritesWidget = memo(FavoritesWidgetComponent);
FavoritesWidget.displayName = 'FavoritesWidget';

export default FavoritesWidget;
