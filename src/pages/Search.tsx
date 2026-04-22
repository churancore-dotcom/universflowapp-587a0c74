import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Music, X, Tag, Sparkles, Globe, Radio, Loader2, Clock, Trash2 } from 'lucide-react';
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
import { SearchSkeleton } from '@/components/PageSkeletons';
import { prefetchIndexedTrack, resolveIndexedTrack, searchIndexedTracks, type IndexedTrack } from '@/lib/musicIndexer';
import {
  getSongHistory,
  removeSongFromHistory,
  clearSongHistory,
  MOOD_QUERIES,
  GENRE_QUERIES,
  type SongHistoryEntry,
} from '@/lib/songHistory';
import { toast } from 'sonner';

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
  { name: 'Sad', color: 'from-slate-500 to-slate-700', icon: '😢' },
  { name: 'Happy', color: 'from-yellow-400 to-amber-500', icon: '😊' },
  { name: 'Party', color: 'from-fuchsia-500 to-pink-500', icon: '🎉' },
];

type SearchSource = 'all' | 'library' | 'indexer';

// Helper: dedupe + interleave indexed tracks across multiple queries
async function searchMultiQuery(queries: string[], perQuery = 15): Promise<IndexedTrack[]> {
  const results = await Promise.all(
    queries.map(q => searchIndexedTracks(q, perQuery).catch(() => [] as IndexedTrack[]))
  );
  const seen = new Set<string>();
  const out: IndexedTrack[] = [];
  // Round-robin interleave so first results from each query appear early
  const max = Math.max(...results.map(r => r.length), 0);
  for (let i = 0; i < max; i++) {
    for (const list of results) {
      const t = list[i];
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
  }
  return out;
}

const mapSongRow = (s: any): Song => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  album: s.album || undefined,
  cover_url: s.cover_url || undefined,
  audio_url: s.audio_url,
  artist_id: (s.artists as any)?.id || s.artist_id || undefined,
  artist_photo_url: (s.artists as any)?.photo_url || undefined,
  source: 'library',
});

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [indexedResults, setIndexedResults] = useState<IndexedTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type: 'genre' | 'mood'; value: string } | null>(null);
  const [source, setSource] = useState<SearchSource>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SongHistoryEntry[]>(() => getSongHistory());
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
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      if (!activeFilter) {
        setResults([]);
        setIndexedResults([]);
      }
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setActiveFilter(null);

      const [libraryResponse, indexedResponse] = await Promise.allSettled([
        searchSongs(trimmedQuery),
        searchIndexedTracks(trimmedQuery, 50),
      ]);

      if (cancelled) return;

      setResults(libraryResponse.status === 'fulfilled' ? libraryResponse.value : []);
      setIndexedResults(indexedResponse.status === 'fulfilled' ? indexedResponse.value : []);
      setSearching(false);
      // Refresh history snapshot (current play might have been added)
      setSearchHistory(getSongHistory());
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeFilter]);

  useEffect(() => {
    indexedResults.slice(0, 6).forEach((track) => {
      prefetchIndexedTrack(track.artist, track.title);
    });
  }, [indexedResults]);

  const searchSongs = async (searchTerm: string) => {
    const safeSearchTerm = searchTerm.replace(/[%,]/g, ' ').trim();
    const { data } = await supabase
      .from('songs')
      .select('*, artists(id, name, photo_url)')
      .eq('is_visible', true)
      .or(`title.ilike.%${safeSearchTerm}%,artist.ilike.%${safeSearchTerm}%,album.ilike.%${safeSearchTerm}%`)
      .limit(30);
    return Array.isArray(data) ? data.map(mapSongRow) : [];
  };

  const handlePlayIndexed = useCallback(async (track: IndexedTrack) => {
    setResolvingId(track.id);
    try {
      const resolved = await resolveIndexedTrack(track.artist, track.title);
      if (!resolved.streamUrl) throw new Error('Could not resolve audio stream. Try another track.');

      const song: Song = {
        id: track.id,
        title: resolved.title || track.title,
        artist: resolved.artist || track.artist,
        album: track.album,
        cover_url: resolved.cover_url || track.cover_url,
        audio_url: resolved.streamUrl,
        duration: resolved.duration || track.duration,
        source: 'indexed',
      };
      playSong(song, undefined, visibleIndexedResults.map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        cover_url: item.cover_url,
        audio_url: item.id === track.id ? resolved.streamUrl! : 'resolving',
        duration: item.duration,
        source: 'indexed' as const,
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Playback failed');
    } finally {
      setResolvingId(null);
    }
  }, [playSong]);

  const searchByGenre = async (genre: string) => {
    setQuery(''); setActiveFilter({ type: 'genre', value: genre }); setSearching(true); setIndexedResults([]);
    // Catalog + Streaming in parallel
    const queries = GENRE_QUERIES[genre] || [genre];
    const [catalogRes, streamRes] = await Promise.allSettled([
      supabase.from('songs').select('*, artists(id, name, photo_url)')
        .eq('is_visible', true).ilike('genre', `%${genre}%`).limit(30),
      searchMultiQuery(queries, 12),
    ]);
    if (catalogRes.status === 'fulfilled' && catalogRes.value.data) {
      setResults(catalogRes.value.data.map(mapSongRow));
    }
    if (streamRes.status === 'fulfilled') setIndexedResults(streamRes.value);
    setSearching(false);
  };

  const searchByMood = async (mood: string) => {
    setQuery(''); setActiveFilter({ type: 'mood', value: mood }); setSearching(true); setIndexedResults([]);
    const queries = MOOD_QUERIES[mood] || [mood];
    const [catalogRes, streamRes] = await Promise.allSettled([
      supabase.from('songs').select('*, artists(id, name, photo_url)')
        .eq('is_visible', true).ilike('mood', `%${mood}%`).limit(30),
      searchMultiQuery(queries, 12),
    ]);
    if (catalogRes.status === 'fulfilled' && catalogRes.value.data) {
      setResults(catalogRes.value.data.map(mapSongRow));
    }
    if (streamRes.status === 'fulfilled') setIndexedResults(streamRes.value);
    setSearching(false);
  };

  const clearFilter = () => {
    setActiveFilter(null); setQuery('');
    setResults([]); setIndexedResults([]);
  };

  const libraryResults: Song[] = source === 'indexer' ? [] : results;

  const visibleIndexedResults = source === 'all' || source === 'indexer' ? indexedResults : [];

  const hasQuery = query.length > 1 || activeFilter;

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, hsl(260 100% 60% / 0.05), transparent),
              radial-gradient(ellipse 60% 40% at 80% 20%, hsl(330 100% 65% / 0.04), transparent)`,
          }} />
        </div>

        {/* Header */}
        <header className="flex-shrink-0 z-30 px-4 pt-3 pb-3 safe-area-pt" style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255, 255, 255, 0.06)',
        }}>
          <motion.h1 className="text-2xl font-bold mb-3 tracking-tight"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            Search
          </motion.h1>

          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
              placeholder="Any song, artist, or album worldwide"
              className="pl-10 pr-8 h-11 text-sm rounded-xl border-0"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: isFocused ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid rgba(255,255,255,0.06)',
                transition: 'border-color 0.2s',
              }} />
            {query && (
              <button onClick={() => { setQuery(''); setIndexedResults([]); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Source tabs */}
          {hasQuery && (
            <div className="flex gap-2 mt-2.5 overflow-x-auto hide-scrollbar">
              {([
                { key: 'all' as SearchSource, label: 'All Songs', icon: Globe },
                { key: 'indexer' as SearchSource, label: 'Worldwide', icon: Radio },
                { key: 'library' as SearchSource, label: 'Your Library', icon: Music },
              ]).map(tab => (
                <motion.button key={tab.key} onClick={() => setSource(tab.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0"
                  style={{
                    background: source === tab.key ? 'hsl(var(--primary) / 0.2)' : 'rgba(255,255,255,0.05)',
                    border: source === tab.key ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: source === tab.key ? 'hsl(var(--primary))' : undefined,
                  }} whileTap={{ scale: 0.95 }}>
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                  {tab.key === 'indexer' && indexedResults.length > 0 && (
                    <span className="ml-0.5 text-[10px] opacity-60">{indexedResults.length}</span>
                  )}
                </motion.button>
              ))}
            </div>
          )}

          {activeFilter && (
            <motion.div className="mt-2.5 flex items-center gap-2"
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: activeFilter.type === 'genre' ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--accent) / 0.15)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                {activeFilter.type === 'genre' ? <Tag className="w-3 h-3 text-primary" /> : <Sparkles className="w-3 h-3 text-accent" />}
                <span className="font-medium text-xs">{activeFilter.value}</span>
                <button onClick={clearFilter} className="ml-1 p-0.5"><X className="w-3 h-3" /></button>
              </div>
            </motion.div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 relative z-10" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            {!query && !activeFilter && (
              <motion.div key="browse" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

                {/* Recently Played (song-based history, Spotify-style) */}
                {searchHistory.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-bold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-muted-foreground" /> Recently Played
                      </h2>
                      <button
                        onClick={() => { clearSongHistory(); setSearchHistory([]); }}
                        className="text-[11px] text-muted-foreground flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    </div>
                    <div className="space-y-1">
                      {searchHistory.slice(0, 8).map((entry) => {
                        const isActive = currentSong?.id === entry.id;
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center gap-3 px-2 py-2 rounded-2xl active:scale-[0.98] transition-all ${isActive ? 'bg-primary/10' : 'active:bg-white/5'}`}
                          >
                            <button
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              onClick={async () => {
                                // Re-resolve indexed songs (audio_url may have expired)
                                if (entry.source === 'indexed' || entry.source === 'audius') {
                                  setResolvingId(entry.id);
                                  try {
                                    const r = await resolveIndexedTrack(entry.artist, entry.title);
                                    if (!r.streamUrl) throw new Error('Could not resolve');
                                    playSong({
                                      id: entry.id,
                                      title: r.title || entry.title,
                                      artist: r.artist || entry.artist,
                                      album: entry.album,
                                      cover_url: r.cover_url || entry.cover_url,
                                      audio_url: r.streamUrl,
                                      duration: r.duration || entry.duration,
                                      source: 'indexed',
                                    });
                                  } catch (err) {
                                    toast.error('Could not play this song');
                                  } finally {
                                    setResolvingId(null);
                                  }
                                } else if (entry.audio_url) {
                                  playSong({
                                    id: entry.id,
                                    title: entry.title,
                                    artist: entry.artist,
                                    album: entry.album,
                                    cover_url: entry.cover_url,
                                    audio_url: entry.audio_url,
                                    duration: entry.duration,
                                    source: entry.source || 'library',
                                  });
                                }
                              }}
                            >
                              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                                {entry.cover_url ? (
                                  <img src={entry.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                    <Music className="w-4 h-4 text-foreground/40" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-[13px] truncate ${isActive ? 'text-primary' : ''}`}>
                                  {resolvingId === entry.id ? 'Loading…' : entry.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{entry.artist}</p>
                              </div>
                            </button>
                            <button
                              onClick={() => {
                                removeSongFromHistory(entry.id);
                                setSearchHistory(getSongHistory());
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground active:bg-white/10"
                              aria-label="Remove from history"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <h2 className="text-sm font-bold mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accent" /> Moods
                </h2>
                <div className="flex gap-2.5 overflow-x-auto pb-4 -mx-4 px-4 hide-scrollbar">
                  {moods.map((mood, i) => (
                    <motion.button key={mood.name}
                      className={`flex-shrink-0 w-[85px] h-16 rounded-2xl overflow-hidden relative bg-gradient-to-br ${mood.color}`}
                      onClick={() => searchByMood(mood.name)}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }} whileTap={{ scale: 0.93 }}
                      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl mb-0.5">{mood.icon}</span>
                        <span className="text-[10px] font-bold text-primary-foreground">{mood.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <h2 className="text-sm font-bold mb-2.5 mt-1 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary" /> Genres
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {genres.map((genre, i) => (
                    <motion.button key={genre.name}
                      className={`relative h-20 rounded-2xl overflow-hidden bg-gradient-to-br ${genre.color}`}
                      onClick={() => searchByGenre(genre.name)}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 + 0.1 }} whileTap={{ scale: 0.95 }}
                      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                      <span className="absolute top-2.5 right-2.5 text-xl">{genre.icon}</span>
                      <span className="absolute bottom-2.5 left-3 text-sm font-bold text-primary-foreground">{genre.name}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          {searching ? <SearchSkeleton /> : (
            <>
              {/* Library results */}
              {libraryResults.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  {source !== 'indexer' && (
                    <h2 className="text-sm font-bold mb-3">
                      {source === 'all' ? 'Library Songs' : 'Your Library'} · {libraryResults.length} results
                    </h2>
                  )}
                  <div className="space-y-1">
                    {libraryResults.map((song, i) => {
                      const isActive = currentSong?.id === song.id;
                      const offlineUrl = getDownloadedUrl(song.id);
                      return (
                        <motion.div key={song.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-all ${isActive ? 'bg-primary/10' : 'active:bg-white/5'}`}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.025, duration: 0.25 }}
                          onClick={() => playSong(song, offlineUrl, libraryResults)}>
                          <div className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${isActive ? 'shadow-lg shadow-primary/20' : 'shadow-md'}`}>
                            {song.cover_url ? (
                              <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                <Music className="w-4 h-4 text-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-[13px] truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
                            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{song.artist}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isActive && isPlaying ? (
                              <div className="flex items-end gap-[2px] h-4 mr-1">
                                {[0, 1, 2].map((j) => (
                                  <div key={j} className="w-[3px] bg-primary rounded-full animate-audio-wave" style={{ animationDelay: `${j * 0.12}s` }} />
                                ))}
                              </div>
                            ) : (
                              <>
                                <LikeButton songId={song.id} size="sm" className="w-8 h-8" />
                                <DownloadButton song={song} size="sm" />
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Indexed stream results */}
              {visibleIndexedResults.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={libraryResults.length > 0 ? 'mt-6' : ''}>
                  <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-primary" />
                    Worldwide Songs · {visibleIndexedResults.length} results
                  </h2>
                  <div className="space-y-1">
                    {visibleIndexedResults.map((track, i) => {
                      const isActive = currentSong?.id === track.id;
                      const isResolving = resolvingId === track.id;
                      return (
                        <motion.div key={track.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-all ${isActive ? 'bg-primary/10' : 'active:bg-white/5'} ${isResolving ? 'opacity-60' : ''}`}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.025, duration: 0.25 }}
                          onClick={() => !isResolving && handlePlayIndexed(track)}>
                          <div className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${isActive ? 'shadow-lg shadow-primary/20' : 'shadow-md'}`}>
                            {track.cover_url ? (
                              <img src={track.cover_url} alt={`${track.title} cover art`} className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                                <Music className="w-4 h-4 text-foreground/30" />
                              </div>
                            )}
                            <div className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md bg-primary flex items-center justify-center">
                              <Radio className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-[13px] truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                              {isResolving ? 'Starting song...' : track.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{track.artist}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isActive && isPlaying ? (
                              <div className="flex items-end gap-[2px] h-4 mr-1">
                                {[0, 1, 2].map((j) => (
                                  <div key={j} className="w-[3px] bg-primary rounded-full animate-audio-wave" style={{ animationDelay: `${j * 0.12}s` }} />
                                ))}
                              </div>
                            ) : isResolving ? (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                              <LikeButton songId={track.id} song={{ id: track.id, title: track.title, artist: track.artist, cover_url: track.cover_url, audio_url: 'resolving', duration: track.duration, source: (track as any).source === 'audius' ? 'audius' : 'indexed' } as Song} size="sm" className="w-8 h-8" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* No results */}
              {(query.length > 1 || activeFilter) && !searching && libraryResults.length === 0 && visibleIndexedResults.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <Music className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground text-sm">No results found</p>
                </div>
              )}
            </>
          )}
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
      </div>
    </TabTransition>
  );
};

export default Search;
