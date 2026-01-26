import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Music, X, Tag, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import LikeButton from '@/components/LikeButton';
import DownloadButton from '@/components/DownloadButton';
import { TabTransition } from '@/components/PageTransition';
import Footer from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { iosSpring, iosBounce } from '@/lib/animations';

const genres = [
  { name: 'Pop', color: 'from-pink-500 to-rose-500', icon: '🎤' },
  { name: 'Rock', color: 'from-red-500 to-orange-500', icon: '🎸' },
  { name: 'Hip Hop', color: 'from-yellow-500 to-amber-500', icon: '🎧' },
  { name: 'R&B', color: 'from-purple-500 to-violet-500', icon: '💜' },
  { name: 'Electronic', color: 'from-cyan-500 to-blue-500', icon: '🎹' },
  { name: 'Jazz', color: 'from-amber-600 to-yellow-600', icon: '🎷' },
  { name: 'Classical', color: 'from-slate-500 to-gray-500', icon: '🎻' },
  { name: 'Indie', color: 'from-emerald-500 to-teal-500', icon: '🌿' },
  { name: 'Lo-Fi', color: 'from-indigo-500 to-purple-600', icon: '🌙' },
  { name: 'Phonk', color: 'from-rose-600 to-red-800', icon: '🔥' },
];

const moods = [
  { name: 'Chill', color: 'from-sky-400 to-cyan-500', icon: '😌' },
  { name: 'Energetic', color: 'from-orange-400 to-red-500', icon: '⚡' },
  { name: 'Romantic', color: 'from-pink-400 to-rose-500', icon: '💕' },
  { name: 'Focus', color: 'from-violet-500 to-purple-600', icon: '🎯' },
  { name: 'Party', color: 'from-yellow-400 to-amber-500', icon: '🎉' },
  { name: 'Workout', color: 'from-green-500 to-emerald-600', icon: '💪' },
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type: 'genre' | 'mood'; value: string } | null>(null);
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { getDownloadedUrl } = useDownloads();

  // Handle URL params for genre/mood navigation from home
  useEffect(() => {
    const genre = searchParams.get('genre');
    const mood = searchParams.get('mood');
    
    if (genre) {
      setActiveFilter({ type: 'genre', value: genre });
      searchByGenre(genre);
      // Clear URL param after processing
      setSearchParams({});
    } else if (mood) {
      setActiveFilter({ type: 'mood', value: mood });
      searchByMood(mood);
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    if (query.length > 1) {
      const timer = setTimeout(() => searchSongs(), 300);
      return () => clearTimeout(timer);
    } else if (!activeFilter) {
      setResults([]);
    }
  }, [query]);

  const searchSongs = async () => {
    setSearching(true);
    setActiveFilter(null);
    const { data } = await supabase
      .from('songs')
      .select('*, artists(id, name, photo_url)')
      .eq('is_visible', true)
      .or(`title.ilike.%${query}%,artist.ilike.%${query}%,album.ilike.%${query}%`)
      .limit(20);

    if (data) {
      setResults(data.map(s => {
        const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
        return {
          id: s.id,
          title: s.title,
          artist: s.artist,
          album: s.album || undefined,
          cover_url: s.cover_url || undefined,
          audio_url: s.audio_url,
          artist_id: artistData?.id || s.artist_id || undefined,
          artist_photo_url: artistData?.photo_url || undefined,
        };
      }));
    }
    setSearching(false);
  };

  const searchByGenre = async (genre: string) => {
    setQuery('');
    setActiveFilter({ type: 'genre', value: genre });
    setSearching(true);
    const { data } = await supabase
      .from('songs')
      .select('*, artists(id, name, photo_url)')
      .eq('is_visible', true)
      .ilike('genre', `%${genre}%`)
      .limit(30);

    if (data) {
      setResults(data.map(s => {
        const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
        return {
          id: s.id,
          title: s.title,
          artist: s.artist,
          album: s.album || undefined,
          cover_url: s.cover_url || undefined,
          audio_url: s.audio_url,
          artist_id: artistData?.id || s.artist_id || undefined,
          artist_photo_url: artistData?.photo_url || undefined,
        };
      }));
    }
    setSearching(false);
  };

  const searchByMood = async (mood: string) => {
    setQuery('');
    setActiveFilter({ type: 'mood', value: mood });
    setSearching(true);
    const { data } = await supabase
      .from('songs')
      .select('*, artists(id, name, photo_url)')
      .eq('is_visible', true)
      .ilike('mood', `%${mood}%`)
      .limit(30);

    if (data) {
      setResults(data.map(s => {
        const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
        return {
          id: s.id,
          title: s.title,
          artist: s.artist,
          album: s.album || undefined,
          cover_url: s.cover_url || undefined,
          audio_url: s.audio_url,
          artist_id: artistData?.id || s.artist_id || undefined,
          artist_photo_url: artistData?.photo_url || undefined,
        };
      }));
    }
    setSearching(false);
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setQuery('');
    setResults([]);
  };

  return (
    <TabTransition>
      <motion.div 
        className="min-h-screen bg-background pb-40 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* iOS-style header with search */}
        <motion.header
          className="sticky top-0 z-30 px-5 pt-4 pb-3 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={iosSpring}
        >
          <motion.h1 
            className="text-[28px] font-bold mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...iosSpring, delay: 0.1 }}
          >
            Search
          </motion.h1>
          
          {/* iOS-style search bar */}
          <motion.div 
            className="relative"
            animate={{
              scale: isFocused ? 1.01 : 1,
            }}
            transition={iosBounce}
          >
            <motion.div
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
              animate={{
                color: isFocused ? 'hsl(211 100% 50%)' : 'hsl(0 0% 40%)',
              }}
            >
              <SearchIcon className="w-5 h-5" />
            </motion.div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Artists, songs, or albums"
              className="pl-12 pr-20 h-12 text-[17px] rounded-xl border-0"
              style={{
                background: 'rgba(118, 118, 128, 0.24)',
              }}
            />
            {query && (
              <motion.button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/20"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </motion.div>

          {/* Active Filter Badge */}
          <AnimatePresence>
            {activeFilter && (
              <motion.div
                className="mt-3 flex items-center gap-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  activeFilter.type === 'genre' ? 'bg-primary/20' : 'bg-accent/20'
                }`}>
                  {activeFilter.type === 'genre' ? (
                    <Tag className="w-4 h-4 text-primary" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-accent" />
                  )}
                  <span className="font-medium text-sm">{activeFilter.value}</span>
                  <motion.button
                    onClick={clearFilter}
                    className="ml-1 p-0.5 rounded-full hover:bg-white/10"
                    whileTap={{ scale: 0.85 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        <main className="px-5 pt-6">
          {/* Browse Section */}
          <AnimatePresence mode="wait">
            {!query && !activeFilter && (
              <motion.div
                key="browse"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={iosSpring}
              >
                {/* Moods Section */}
                <h2 className="text-[20px] font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Browse by Mood
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar -mx-5 px-5">
                  {moods.map((mood, index) => (
                    <motion.button
                      key={mood.name}
                      className={`flex-shrink-0 w-28 h-20 rounded-2xl overflow-hidden relative bg-gradient-to-br ${mood.color}`}
                      onClick={() => searchByMood(mood.name)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...iosSpring, delay: index * 0.04 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl mb-1">{mood.icon}</span>
                        <span className="text-xs font-bold text-white">{mood.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Genres Section */}
                <h2 className="text-[20px] font-bold mb-3 mt-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  Browse by Genre
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {genres.map((genre, index) => (
                    <motion.button
                      key={genre.name}
                      className={`relative h-24 rounded-2xl overflow-hidden bg-gradient-to-br ${genre.color}`}
                      onClick={() => searchByGenre(genre.name)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...iosSpring, delay: index * 0.04 }}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span className="absolute top-3 right-3 text-2xl">{genre.icon}</span>
                      <span className="absolute bottom-3 left-4 text-lg font-bold text-white drop-shadow-lg">
                        {genre.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Results */}
          <AnimatePresence mode="wait">
            {searching ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center py-16"
              >
                <motion.div 
                  className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            ) : results.length > 0 ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="text-lg font-bold mb-4">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </h2>
                <div className="space-y-1">
                  {results.map((song, index) => {
                    const isActive = currentSong?.id === song.id;
                    const offlineUrl = getDownloadedUrl(song.id);
                    return (
                      <motion.div
                        key={song.id}
                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                          isActive ? 'bg-primary/10' : 'active:bg-white/5'
                        }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...iosSpring, delay: index * 0.03 }}
                      >
                        <motion.button
                          className="flex-1 flex items-center gap-3 text-left min-w-0"
                          onClick={() => playSong(song, offlineUrl, results)}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {song.cover_url ? (
                              <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-[15px] truncate ${isActive ? 'text-primary' : ''}`}>
                              {song.title}
                            </p>
                            <p className="text-[13px] text-muted-foreground truncate">{song.artist}</p>
                          </div>
                        </motion.button>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          {isActive && isPlaying ? (
                            <div className="flex items-end gap-[3px] h-4 mr-2">
                              {[...Array(3)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  className="w-[3px] bg-primary rounded-full"
                                  animate={{ height: [5, 14, 5] }}
                                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                                />
                              ))}
                            </div>
                          ) : (
                            <>
                              <LikeButton songId={song.id} size="sm" />
                              <DownloadButton song={song} size="sm" />
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (query.length > 1 || activeFilter) && !searching ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-16"
                transition={iosSpring}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...iosBounce, delay: 0.1 }}
                >
                  <Music className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
                </motion.div>
                <p className="text-muted-foreground text-lg">No results found</p>
                <p className="text-muted-foreground/60 text-sm mt-1">
                  {activeFilter 
                    ? `No songs tagged with "${activeFilter.value}" yet`
                    : 'Try a different search term'
                  }
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
          
          <Footer />
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
      </motion.div>
    </TabTransition>
  );
};

export default Search;
