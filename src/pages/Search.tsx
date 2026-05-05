import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Music, X, Globe, Radio, Loader2, Clock, Trash2 } from 'lucide-react';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import BottomNav from '@/components/BottomNav';
import LikeButton from '@/components/LikeButton';
import DownloadButton from '@/components/DownloadButton';
import { TabTransition } from '@/components/PageTransition';
import { Input } from '@/components/ui/input';
import { SearchSkeleton } from '@/components/PageSkeletons';
import { prefetchIndexedTrack, searchIndexedTracks, type IndexedTrack } from '@/lib/musicIndexer';
import { isCatalogSongId } from '@/lib/songSupport';
import {
  getSongHistory,
  removeSongFromHistory,
  clearSongHistory,
  type SongHistoryEntry,
} from '@/lib/songHistory';

type SearchSource = 'all' | 'indexer';

const Search = () => {
  const [query, setQuery] = useState('');
  const [indexedResults, setIndexedResults] = useState<IndexedTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [source, setSource] = useState<SearchSource>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SongHistoryEntry[]>(() => getSongHistory().filter(entry => !isCatalogSongId(entry.id)));
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { getDownloadedUrl } = useDownloads();

  // Refresh history snapshot whenever the currently playing song changes
  useEffect(() => {
    if (currentSong) setSearchHistory(getSongHistory().filter(entry => !isCatalogSongId(entry.id)));
  }, [currentSong?.id]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setIndexedResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const indexedResponse = await searchIndexedTracks(trimmedQuery, 50);
        if (cancelled) return;
        setIndexedResults(indexedResponse);
        setSearchHistory(getSongHistory().filter(entry => !isCatalogSongId(entry.id)));
      } catch {
        if (!cancelled) setIndexedResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    indexedResults.slice(0, 6).forEach((track) => {
      prefetchIndexedTrack(track.artist, track.title);
    });
  }, [indexedResults]);

  const libraryResults: Song[] = [];

  const visibleIndexedResults = source === 'all' || source === 'indexer' ? indexedResults : [];

  const handlePlayIndexed = useCallback((track: IndexedTrack) => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      cover_url: track.cover_url,
      audio_url: 'resolving',
      duration: track.duration,
      source: 'indexed',
    };
    playSong(song, undefined, visibleIndexedResults.map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album,
      cover_url: item.cover_url,
      audio_url: 'resolving',
      duration: item.duration,
      source: 'indexed' as const,
    })));
  }, [playSong, visibleIndexedResults]);

  const hasQuery = query.length > 1;

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

        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32 relative z-10" style={{ WebkitOverflowScrolling: 'touch' }}>
          <AnimatePresence mode="wait">
            {!query && (
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
                                if (entry.source === 'indexed' || entry.source === 'audius') {
                                  playSong({
                                    id: entry.id,
                                    title: entry.title,
                                    artist: entry.artist,
                                    album: entry.album,
                                    cover_url: entry.cover_url,
                                    audio_url: entry.audio_url || 'resolving',
                                    duration: entry.duration,
                                    source: 'indexed',
                                  });
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
                                setSearchHistory(getSongHistory().filter(item => !isCatalogSongId(item.id)));
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          {searching ? <SearchSkeleton /> : (
            <>
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
              {query.length > 1 && !searching && libraryResults.length === 0 && visibleIndexedResults.length === 0 && (
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
      </div>
    </TabTransition>
  );
};

export default Search;
