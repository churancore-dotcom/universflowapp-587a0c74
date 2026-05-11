import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Music, X, Globe, Radio, Loader2, Clock, Trash2, EyeOff } from 'lucide-react';
import { usePlayer, Song } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import BottomNav from '@/components/BottomNav';
import LikeButton from '@/components/LikeButton';
import PinToViralButton from '@/components/PinToViralButton';
import DownloadButton from '@/components/DownloadButton';
import { TabTransition } from '@/components/PageTransition';
import { Input } from '@/components/ui/input';
import { SearchSkeleton } from '@/components/PageSkeletons';
import { prefetchIndexedTrack, searchIndexedTracks, getTagTopTracks, searchYouTubeMusicTracks, type IndexedTrack } from '@/lib/musicIndexer';
import { isCatalogSongId } from '@/lib/songSupport';
import { detectMoodAndLanguage } from '@/lib/moodKeywords';
import FollowedArtistsRail from '@/components/FollowedArtistsRail';
import { clearCache, getCached, setCached } from '@/lib/searchCache';
import {
  getSongHistory,
  removeSongFromHistory,
  clearSongHistory,
  type SongHistoryEntry,
} from '@/lib/songHistory';

type SearchSource = 'all' | 'indexer';

const normalizeText = (value = '') => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const cleanIdentity = (value = '') => normalizeText(value).replace(/\b(official|lyrics?|video|audio|hd|4k|topic|vevo|records|music)\b/g, '').replace(/\s+/g, ' ').trim();
const resultKey = (track: IndexedTrack) => `${cleanIdentity(track.artist)}::${cleanIdentity(track.title)}`;
const queryTokens = (query: string) => normalizeText(query).split(' ').filter((token) => token.length > 1 && !['song', 'songs', 'music', 'track', 'tracks', 'best', 'top', 'latest', 'new'].includes(token));
const HIDDEN_RESULTS_KEY = 'uf_hidden_search_results_v1';
const SEARCH_CACHE_NAMESPACE = 'stable-search-v4';

type HiddenSearchEntry = {
  key: string;
  id?: string;
  videoId?: string;
  title: string;
  artist: string;
  hiddenAt: number;
};

function loadHiddenResults(): HiddenSearchEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_RESULTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.key === 'string') : [];
  } catch {
    return [];
  }
}

function saveHiddenResults(entries: HiddenSearchEntry[]) {
  try {
    localStorage.setItem(HIDDEN_RESULTS_KEY, JSON.stringify(entries.slice(0, 500)));
  } catch { /* ignore quota */ }
}

function isHiddenTrack(track: IndexedTrack, hiddenEntries: HiddenSearchEntry[]) {
  const key = resultKey(track);
  const videoId = track.videoId || (track.id.startsWith('ytm-') ? track.id.slice(4) : undefined);
  return hiddenEntries.some((entry) =>
    entry.key === key ||
    (videoId && entry.videoId === videoId) ||
    (track.id && entry.id === track.id)
  );
}

function hideSearchTrack(track: IndexedTrack) {
  const key = resultKey(track);
  if (!key || key === '::') return;
  const videoId = track.videoId || (track.id.startsWith('ytm-') ? track.id.slice(4) : undefined);
  const existing = loadHiddenResults().filter((entry) => entry.key !== key && entry.id !== track.id && (!videoId || entry.videoId !== videoId));
  saveHiddenResults([
    { key, id: track.id, videoId, title: track.title, artist: track.artist, hiddenAt: Date.now() },
    ...existing,
  ]);
  clearCache(SEARCH_CACHE_NAMESPACE);
}

function rankAndDedupeResults(query: string, youtube: IndexedTrack[], literal: IndexedTrack[], tagSets: IndexedTrack[][], allowDiscoveryFallback = false) {
  const tokens = queryTokens(query);
  const rows = new Map<string, { track: IndexedTrack; score: number; firstSeen: number; sourcePriority: number }>();
  let firstSeen = 0;

  const add = (track: IndexedTrack, base: number, index: number, sourcePriority: number) => {
    const key = resultKey(track);
    if (!key || key === '::') return;
    const haystack = normalizeText(`${track.title} ${track.artist} ${track.album || ''}`);
    const tokenHits = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    const allTokens = tokens.length > 0 && tokenHits === tokens.length;
    const phraseHit = normalizeText(query).length > 2 && haystack.includes(normalizeText(query));
    if (!allowDiscoveryFallback && tokens.length > 0 && tokenHits === 0 && !phraseHit) return;
    const popularity = Math.min(40, Math.log10(Math.max(1, track.listeners || 0)) * 8);
    const title = normalizeText(track.title || '');
    const artist = normalizeText(track.artist || '');
    const exactArtist = tokens.length > 0 && tokens.every((token) => artist.includes(token));
    const exactTitle = normalizeText(query).length > 2 && title.includes(normalizeText(query));
    const relevance = (phraseHit ? 220 : 0) + (exactTitle ? 160 : 0) + (exactArtist ? 150 : 0) + (allTokens ? 140 : 0) + tokenHits * 34;
    const score = base + relevance + popularity - index * 0.6;
    const existing = rows.get(key);
    if (!existing || score > existing.score || (score === existing.score && sourcePriority > existing.sourcePriority)) {
      rows.set(key, { track, score, firstSeen: existing?.firstSeen ?? firstSeen++, sourcePriority });
    }
  };

  youtube.forEach((track, index) => add(track, 700, index, 3));
  literal.forEach((track, index) => add(track, 360, index, 2));
  tagSets.forEach((set, setIndex) => set.forEach((track, index) => add(track, 260 + setIndex * 40, index, 1)));

  return Array.from(rows.values())
    .sort((a, b) => b.score - a.score || b.sourcePriority - a.sourcePriority || a.firstSeen - b.firstSeen || a.track.title.localeCompare(b.track.title) || a.track.artist.localeCompare(b.track.artist))
    .map(({ track }) => track);
}

const Search = () => {
  const [query, setQuery] = useState('');
  const [indexedResults, setIndexedResults] = useState<IndexedTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [source, setSource] = useState<SearchSource>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SongHistoryEntry[]>(() => getSongHistory());
  const [hiddenResults, setHiddenResults] = useState<HiddenSearchEntry[]>(() => loadHiddenResults());
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { getDownloadedUrl } = useDownloads();

  // Refresh history snapshot whenever the currently playing song changes
  useEffect(() => {
    if (currentSong) setSearchHistory(getSongHistory());
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
        const cached = getCached<IndexedTrack[]>(SEARCH_CACHE_NAMESPACE, trimmedQuery);
        if (cached) {
          if (!cancelled) setIndexedResults(cached.filter((track) => !isHiddenTrack(track, hiddenResults)));
          return;
        }
        // YouTube-style: detect mood + language separately. e.g. "hindi sad
        // song" → language=hindi, mood=sad. We then fetch BOTH tag charts and
        // intersect by artist (or rank by overlap) so users actually get sad
        // Hindi tracks, not English songs whose title contains "sad".
        const { mood, language, pureBrowse } = detectMoodAndLanguage(trimmedQuery);
        const smartQuery = [language, mood, 'song'].filter(Boolean).join(' ') || trimmedQuery;
        const tagJobs: Promise<IndexedTrack[]>[] = [];
        if (language) tagJobs.push(getTagTopTracks(language, 150));
        if (mood) tagJobs.push(getTagTopTracks(mood, 150));
        // Skip the literal text search when the query is just mood/language
        // words (e.g. "hindi sad song") — it would just return English title hits.
        const literalJob = pureBrowse
          ? Promise.resolve([] as IndexedTrack[])
          : searchIndexedTracks(trimmedQuery, 200);
        const youtubeJob = searchYouTubeMusicTracks(smartQuery, 50);

        const [youtube, literal, ...tagSets] = await Promise.all([youtubeJob, literalJob, ...tagJobs]);
        if (cancelled) return;

        const merged = rankAndDedupeResults(trimmedQuery, youtube, literal, tagSets, pureBrowse)
          .filter((track) => !isHiddenTrack(track, hiddenResults))
          .slice(0, 120);
        setCached(SEARCH_CACHE_NAMESPACE, trimmedQuery, merged);

        setIndexedResults(merged);
        setSearchHistory(getSongHistory());
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
  }, [query, hiddenResults]);

  useEffect(() => {
    indexedResults.slice(0, 6).forEach((track) => {
      prefetchIndexedTrack(track.artist, track.title);
    });
  }, [indexedResults]);

  const libraryResults: Song[] = [];

  const visibleIndexedResults = source === 'all' || source === 'indexer' ? indexedResults : [];

  const handleHideIndexed = useCallback((track: IndexedTrack) => {
    hideSearchTrack(track);
    const nextHidden = loadHiddenResults();
    setHiddenResults(nextHidden);
    setIndexedResults((results) => results.filter((item) => !isHiddenTrack(item, nextHidden)));
  }, []);

  const handlePlayIndexed = useCallback((track: IndexedTrack) => {
    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      cover_url: track.cover_url,
      audio_url: track.audio_url || 'resolving',
      duration: track.duration,
      source: 'indexed',
    };
    playSong(song, undefined, visibleIndexedResults.map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album,
      cover_url: item.cover_url,
      audio_url: item.audio_url || 'resolving',
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
                      {searchHistory.slice(0, 20).map((entry) => {
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

                {/* Followed artists rail (shows on browse / empty state) */}
                <div className="mt-4">
                  <FollowedArtistsRail />
                </div>
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
                              <>
                                <PinToViralButton
                                  song={{
                                    track_id: track.id,
                                    title: track.title,
                                    artist: track.artist,
                                    cover_url: track.cover_url,
                                    audio_url: track.audio_url,
                                    source: (track as any).source === 'audius' ? 'audius' : 'indexed',
                                  }}
                                  variant="inline"
                                />
                                <LikeButton songId={track.id} song={{ id: track.id, title: track.title, artist: track.artist, cover_url: track.cover_url, audio_url: 'resolving', duration: track.duration, source: (track as any).source === 'audius' ? 'audius' : 'indexed' } as Song} size="sm" className="w-8 h-8" />
                              </>
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
