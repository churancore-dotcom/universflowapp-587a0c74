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
import { Input } from '@/components/ui/input';

const genres = [
  { name: 'Pop', color: 'from-pink-500 to-rose-500', icon: '🎤' },
  { name: 'Rock', color: 'from-red-500 to-orange-500', icon: '🎸' },
  { name: 'Hip Hop', color: 'from-yellow-500 to-amber-500', icon: '🎧' },
  { name: 'R&B', color: 'from-purple-500 to-violet-500', icon: '💜' },
  { name: 'Electronic', color: 'from-cyan-500 to-blue-500', icon: '🎹' },
  { name: 'Jazz', color: 'from-amber-600 to-yellow-600', icon: '🎷' },
];

const moods = [
  { name: 'Chill', color: 'from-sky-400 to-cyan-500', icon: '😌' },
  { name: 'Energetic', color: 'from-orange-400 to-red-500', icon: '⚡' },
  { name: 'Romantic', color: 'from-pink-400 to-rose-500', icon: '💕' },
  { name: 'Focus', color: 'from-violet-500 to-purple-600', icon: '🎯' },
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

  useEffect(() => {
    const genre = searchParams.get('genre');
    const mood = searchParams.get('mood');
    
    if (genre) {
      setActiveFilter({ type: 'genre', value: genre });
      searchByGenre(genre);
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
      .limit(15);

    if (data) {
      setResults(data.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album || undefined,
        cover_url: s.cover_url || undefined,
        audio_url: s.audio_url,
        artist_id: (s.artists as any)?.id || s.artist_id || undefined,
        artist_photo_url: (s.artists as any)?.photo_url || undefined,
      })));
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
      .limit(20);

    if (data) {
      setResults(data.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album || undefined,
        cover_url: s.cover_url || undefined,
        audio_url: s.audio_url,
        artist_id: (s.artists as any)?.id || s.artist_id || undefined,
        artist_photo_url: (s.artists as any)?.photo_url || undefined,
      })));
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
      .limit(20);

    if (data) {
      setResults(data.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album || undefined,
        cover_url: s.cover_url || undefined,
        audio_url: s.audio_url,
        artist_id: (s.artists as any)?.id || s.artist_id || undefined,
        artist_photo_url: (s.artists as any)?.photo_url || undefined,
      })));
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
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-2 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
          }}
        >
          <h1 className="text-xl font-bold mb-2">Search</h1>
          
          {/* Search bar */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Artists, songs, or albums"
              className="pl-9 pr-8 h-10 text-sm rounded-xl border-0"
              style={{ background: 'rgba(118, 118, 128, 0.24)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/20"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Active Filter */}
          {activeFilter && (
            <div className="mt-2 flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                activeFilter.type === 'genre' ? 'bg-primary/20' : 'bg-accent/20'
              }`}>
                {activeFilter.type === 'genre' ? (
                  <Tag className="w-3 h-3 text-primary" />
                ) : (
                  <Sparkles className="w-3 h-3 text-accent" />
                )}
                <span className="font-medium text-xs">{activeFilter.value}</span>
                <button onClick={clearFilter} className="ml-1 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-3 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            {!query && !activeFilter && (
              <motion.div
                key="browse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Moods */}
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Moods
                </h2>
                <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 hide-scrollbar">
                  {moods.map((mood) => (
                    <button
                      key={mood.name}
                      className={`flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden relative bg-gradient-to-br ${mood.color}`}
                      onClick={() => searchByMood(mood.name)}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg mb-0.5">{mood.icon}</span>
                        <span className="text-[10px] font-bold text-white">{mood.name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Genres */}
                <h2 className="text-sm font-bold mb-2 mt-3 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary" />
                  Genres
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {genres.map((genre) => (
                    <button
                      key={genre.name}
                      className={`relative h-16 rounded-xl overflow-hidden bg-gradient-to-br ${genre.color}`}
                      onClick={() => searchByGenre(genre.name)}
                    >
                      <span className="absolute top-2 right-2 text-lg">{genre.icon}</span>
                      <span className="absolute bottom-2 left-3 text-sm font-bold text-white">
                        {genre.name}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          {searching ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div>
              <h2 className="text-sm font-bold mb-2">{results.length} results</h2>
              <div className="space-y-1">
                {results.map((song) => {
                  const isActive = currentSong?.id === song.id;
                  const offlineUrl = getDownloadedUrl(song.id);
                  return (
                    <div
                      key={song.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl ${
                        isActive ? 'bg-primary/10' : 'active:bg-white/5'
                      }`}
                    >
                      <button
                        className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                        onClick={() => playSong(song, offlineUrl, results)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {song.cover_url ? (
                            <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isActive ? 'text-primary' : ''}`}>
                            {song.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                      </button>
                      
                      <div className="flex items-center gap-0.5">
                        {isActive && isPlaying ? (
                          <div className="flex items-end gap-[2px] h-3 mr-1.5">
                            {[...Array(3)].map((_, i) => (
                              <motion.div
                                key={i}
                                className="w-[2px] bg-primary rounded-full"
                                animate={{ height: [4, 10, 4] }}
                                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
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
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (query.length > 1 || activeFilter) && !searching ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(118, 118, 128, 0.12)' }}>
                <Music className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">No results found</p>
            </div>
          ) : null}
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
      </div>
    </TabTransition>
  );
};

export default Search;