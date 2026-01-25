import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Music, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { iosSpring, iosBounce } from '@/lib/animations';

const FavoritesWidget = () => {
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    // Get top 5 liked songs with artist data
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

  const handlePlayFavorite = (song: Song) => {
    playSong(song, undefined, favorites);
  };

  if (loading || favorites.length === 0) return null;

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...iosSpring, delay: 0.1 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary" fill="currentColor" />
        <h2 className="text-lg font-bold">Your Favorites</h2>
      </div>

      {/* Quick access grid */}
      <div className="grid grid-cols-5 gap-3">
        {favorites.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          
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
                  isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''
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
                
                {/* Play overlay on hover */}
                <motion.div 
                  className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ opacity: 1 }}
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <Play className="w-4 h-4 text-black ml-0.5" fill="black" />
                  </div>
                </motion.div>

                {/* Playing indicator */}
                {isActive && isPlaying && (
                  <div className="absolute bottom-1 right-1 flex items-end gap-0.5 h-3">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-primary rounded-full"
                        animate={{ height: [3, 10, 3] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Song title - hidden on mobile, shown on hover */}
              <p className="mt-2 text-[11px] font-medium truncate text-center hidden sm:block">
                {song.title}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default FavoritesWidget;
