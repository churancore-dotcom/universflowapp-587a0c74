import React, { useEffect, useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useSongCache } from '@/hooks/useSongCache';
import { useAuth } from '@/contexts/AuthContext';
import { useDownloads } from '@/contexts/DownloadContext';

import GlobalTopTracksSection from '@/components/GlobalTopTracksSection';
import ArtistsRail from '@/components/home/ArtistsRail';
import QueueDrawer from '@/components/QueueDrawer';
import BottomNav from '@/components/BottomNav';
import LockScreenPlayer from '@/components/LockScreenPlayer';
import EqualizerModal from '@/components/EqualizerModal';
import OfflineIndicator from '@/components/OfflineIndicator';
import { TabTransition } from '@/components/PageTransition';
import {
  Music, Lock, ListMusic, Sliders, Search, Play, Pause, Sparkles,
  ArrowUpRight, Loader2,
} from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptics';
import appLogo from '@/assets/app-logo.png';
import { HomeSkeleton } from '@/components/PageSkeletons';
import {
  getTopIndexedTracks,
  resolveIndexedTrack,
  forceResolveIndexedTrack,
  prefetchIndexedTrack,
  detectCountry,
  type IndexedTrack,
} from '@/lib/musicIndexer';
import { flagFor, nameFor } from '@/lib/countries';

const HOME_SONGS_QUERY_KEY = ['home', 'songs'] as const;

const fetchHomeSongs = async (): Promise<Song[]> => {
  const { data, error } = await supabase
    .from('songs')
    .select('*, artists(id, name, photo_url)')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  if (!data) return [];
  return data.map((s: any) => {
    const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
    return {
      id: s.id, title: s.title, artist: s.artist,
      album: s.album || undefined, cover_url: s.cover_url || undefined,
      audio_url: s.audio_url, duration: s.duration || undefined,
      artist_id: artistData?.id || s.artist_id || undefined,
      artist_photo_url: artistData?.photo_url || undefined,
      genre: s.genre || undefined, mood: s.mood || undefined,
      created_at: s.created_at || undefined,
      show_in_new_releases: s.show_in_new_releases,
      show_in_trending: s.show_in_trending,
      is_premium_only: s.is_premium_only,
    } as Song;
  });
};

/* Color palette for mood/gradient tiles */
const PALETTE = [
  ['#FF2D55', '#7A0A2A'],
  ['#FF6A00', '#7A1F00'],
  ['#9D4EDD', '#2A0A4A'],
  ['#00C2FF', '#003D5C'],
  ['#3DDC97', '#0B3D2E'],
  ['#FFD60A', '#5C4400'],
  ['#FF4081', '#4A0028'],
  ['#7C5CFF', '#1F0F5C'],
];
const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const Home = () => {
  const navigate = useNavigate();
  const { currentSong, isPlaying, togglePlay, setExpanded, playSong } = usePlayer();
  const { cachedSongs, updateCache } = useSongCache();
  const { isOffline, user } = useAuth() as any;
  const { downloads } = useDownloads();
  const queryClient = useQueryClient();
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);

  const { data: onlineSongs = (cachedSongs || []), isLoading } = useQuery({
    queryKey: HOME_SONGS_QUERY_KEY,
    queryFn: fetchHomeSongs,
    initialData: cachedSongs && cachedSongs.length > 0 ? cachedSongs : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !isOffline,
  });

  const songs: Song[] = useMemo(() => {
    if (isOffline) {
      return downloads.map((d) => ({
        id: d.id, title: d.title, artist: d.artist, album: d.album,
        cover_url: d.cover_url, audio_url: d.audio_url, duration: d.duration,
      } as Song));
    }
    return onlineSongs;
  }, [isOffline, downloads, onlineSongs]);

  useEffect(() => {
    if (!isOffline && onlineSongs && onlineSongs.length > 0) updateCache(onlineSongs);
  }, [onlineSongs, updateCache, isOffline]);

  const loading = isLoading && songs.length === 0 && !isOffline;

  // Realtime diff patching
  useEffect(() => {
    if (isOffline) return;
    const channel = supabase
      .channel('songs-realtime-diff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        queryClient.setQueryData<Song[]>(HOME_SONGS_QUERY_KEY, (current) => {
          if (!current) return current;
          if (eventType === 'DELETE') return current.filter((s) => s.id !== oldRow?.id);
          if (!newRow) return current;
          if (newRow.is_visible === false) return current.filter((s) => s.id !== newRow.id);
          const mapped: Song = {
            id: newRow.id, title: newRow.title, artist: newRow.artist,
            album: newRow.album || undefined, cover_url: newRow.cover_url || undefined,
            audio_url: newRow.audio_url, duration: newRow.duration || undefined,
            artist_id: newRow.artist_id || undefined,
            show_in_new_releases: newRow.show_in_new_releases,
            show_in_trending: newRow.show_in_trending,
            is_premium_only: newRow.is_premium_only,
          } as Song;
          const idx = current.findIndex((s) => s.id === newRow.id);
          if (eventType === 'INSERT' || idx === -1) return [mapped, ...current];
          const next = current.slice();
          next[idx] = { ...current[idx], ...mapped };
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, isOffline]);

  const userName = useMemo(() => {
    const meta = (user?.user_metadata || {}) as any;
    return (meta.username || meta.full_name || (user?.email ? String(user.email).split('@')[0] : '')) || '';
  }, [user]);

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  // User country
  const { data: userCountry = '' } = useQuery({
    queryKey: ['profile', 'country', user?.id || 'anon'],
    queryFn: async () => {
      if (!user?.id) return detectCountry();
      const { data } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('user_id', user.id)
        .maybeSingle();
      return ((data as any)?.country_code as string) || detectCountry();
    },
    staleTime: 60 * 60 * 1000,
  });

  // Real viral trending — country scoped
  const {
    data: trending = [],
    isLoading: trendingLoading,
  } = useQuery({
    queryKey: ['home', 'viral', userCountry || 'auto'],
    queryFn: () => getTopIndexedTracks(30, userCountry || undefined),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !isOffline,
  });

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handlePlayTrending = async (track: IndexedTrack, queue: IndexedTrack[]) => {
    triggerHaptic('selection');
    if (currentSong?.id === track.id) { togglePlay(); return; }
    setResolvingId(track.id);
    try {
      let r = await resolveIndexedTrack(track.artist, track.title);
      if (!r.streamUrl) r = await forceResolveIndexedTrack(track.artist, track.title);
      if (!r.streamUrl) return;
      const song: Song = {
        id: track.id,
        title: r.title || track.title,
        artist: r.artist || track.artist,
        album: track.album,
        cover_url: r.cover_url || track.cover_url,
        audio_url: r.streamUrl,
        duration: r.duration || track.duration,
        source: 'indexed',
      } as Song;
      const q: Song[] = queue.map((t) => ({
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        cover_url: t.cover_url, audio_url: 'resolving', duration: t.duration,
        source: 'indexed' as const,
      } as Song));
      playSong(song, undefined, q);
    } finally {
      setResolvingId(null);
    }
  };

  // Prefetch top 8 stream resolutions
  useEffect(() => {
    trending.slice(0, 8).forEach((t) => prefetchIndexedTrack(t.artist, t.title));
  }, [trending]);

  // Hero pick = #1 trending if available, else first catalog song with cover
  const heroTrack: { type: 'trend'; t: IndexedTrack } | { type: 'song'; s: Song } | null = useMemo(() => {
    if (trending && trending[0]) return { type: 'trend', t: trending[0] };
    const s = songs.find((x) => x.cover_url) || songs[0];
    return s ? { type: 'song', s } : null;
  }, [trending, songs]);

  // Spotify-style shortcut grid: blend liked/recent catalog songs
  const shortcuts = useMemo(() => songs.filter((s) => s.cover_url).slice(0, 6), [songs]);

  // Top 10 trending for vertical chart
  const top10 = useMemo(() => trending.slice(0, 10), [trending]);
  // Trending tail (11-30) shown as scroll cards
  const trendingTail = useMemo(() => trending.slice(10, 30), [trending]);

  // Mixes
  const mixes = useMemo(() => buildMixes(songs), [songs]);
  // Fresh drops
  const freshDrops = useMemo(() => songs.slice(0, 12), [songs]);

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-black relative flex flex-col overflow-hidden text-white">
        {/* Compact header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-2 safe-area-pt"
          style={{
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderBottom: '0.5px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { triggerHaptic('selection'); navigate('/profile'); }}
              className="flex items-center gap-2.5 min-w-0 active:opacity-60"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/15">
                <img src={appLogo} alt="UniversFlow" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/50 font-bold truncate leading-none">
                  {today}
                </p>
                <p className="text-[15px] font-extrabold tracking-tight leading-tight truncate mt-1">
                  {userName ? `Hey, ${userName}` : 'Welcome back'}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1">
              {[
                { icon: Search, action: () => navigate('/search') },
                { icon: ListMusic, action: () => setShowQueue(true) },
                { icon: Sliders, action: () => setShowEqualizer(true) },
                { icon: Lock, action: () => setShowLockScreen(true) },
              ].map(({ icon: Icon, action }, i) => (
                <motion.button
                  key={i}
                  onClick={() => { triggerHaptic('selection'); action(); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  whileTap={{ scale: 0.85 }}
                >
                  <Icon className="w-[18px] h-[18px] text-white/85" />
                </motion.button>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden pb-36 relative z-10"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            <div className="px-3 pt-4"><HomeSkeleton /></div>
          ) : (
            <>
              {/* ───── EDITORIAL HERO ───── */}
              <EditorialHero
                hero={heroTrack}
                isPlayingHero={
                  heroTrack?.type === 'trend'
                    ? currentSong?.id === heroTrack.t.id && isPlaying
                    : heroTrack?.type === 'song'
                      ? currentSong?.id === heroTrack.s.id && isPlaying
                      : false
                }
                onPlay={() => {
                  if (!heroTrack) { navigate('/search'); return; }
                  if (heroTrack.type === 'trend') {
                    handlePlayTrending(heroTrack.t, trending);
                  } else {
                    if (currentSong?.id === heroTrack.s.id) togglePlay();
                    else playSong(heroTrack.s, undefined, songs);
                  }
                }}
              />

              {/* ───── QUICK SHORTCUTS (2-col grid) ───── */}
              {shortcuts.length > 0 && (
                <section className="px-3 pt-5">
                  <div className="grid grid-cols-2 gap-2">
                    {shortcuts.map((s) => {
                      const active = currentSong?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            triggerHaptic('selection');
                            if (active) togglePlay();
                            else playSong(s, undefined, songs);
                          }}
                          className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] active:bg-white/[0.1] overflow-hidden h-14 pr-2.5"
                        >
                          <div className="w-14 h-14 flex-shrink-0 bg-white/5">
                            {s.cover_url ? (
                              <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-white/30" /></div>
                            )}
                          </div>
                          <p className={`text-[12.5px] font-bold leading-tight line-clamp-2 text-left flex-1 min-w-0 ${active ? 'text-rose-400' : 'text-white'}`}>
                            {s.title}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ───── TOP 10 — Vertical chart with massive numbers ───── */}
              <section className="pt-7">
                <div className="px-3">
                  <SectionTitle
                    eyebrow={userCountry ? `${flagFor(userCountry)} Top in ${nameFor(userCountry)}` : 'Worldwide'}
                    title="Top 10 today"
                  />
                </div>
                <div className="mt-3 px-3 space-y-1">
                  {trendingLoading && top10.length === 0
                    ? Array.from({ length: 10 }).map((_, i) => (
                        <div key={`sk-${i}`} className="flex items-center gap-3 py-2">
                          <div className="w-10 h-8 rounded bg-white/[0.05] animate-pulse" />
                          <div className="w-14 h-14 rounded-lg bg-white/[0.06] animate-pulse" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-3/4 rounded bg-white/[0.06] animate-pulse" />
                            <div className="h-2.5 w-1/2 rounded bg-white/[0.05] animate-pulse" />
                          </div>
                        </div>
                      ))
                    : top10.map((s, i) => {
                        const active = currentSong?.id === s.id;
                        const isResolving = resolvingId === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => handlePlayTrending(s, trending)}
                            className="w-full flex items-center gap-3 py-2 rounded-xl active:bg-white/[0.05] text-left"
                          >
                            <span className={`w-10 text-center font-black tabular-nums leading-none flex-shrink-0 ${
                              i < 3 ? 'text-rose-500 text-[34px]' : 'text-white/25 text-[28px]'
                            }`}>
                              {i + 1}
                            </span>
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                              {s.cover_url ? (
                                <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-white/30" /></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-[14px] font-bold leading-tight ${active ? 'text-rose-400' : 'text-white'}`}>{s.title}</p>
                              <p className="truncate text-[12px] text-white/50 mt-0.5">{s.artist}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                              {isResolving
                                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                : active && isPlaying
                                  ? <Pause className="w-4 h-4 text-white" fill="currentColor" />
                                  : <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />}
                            </div>
                          </button>
                        );
                      })}
                </div>
              </section>

              {/* ───── More trending (scroll cards) ───── */}
              {trendingTail.length > 0 && (
                <section className="pt-7">
                  <div className="px-3">
                    <SectionTitle eyebrow="Climbing fast" title="More to discover" />
                  </div>
                  <div
                    className="flex gap-3 overflow-x-auto hide-scrollbar px-3 pb-1 mt-3 snap-x"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {trendingTail.map((t) => {
                      const active = currentSong?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handlePlayTrending(t, trending)}
                          className="flex-shrink-0 w-[140px] snap-start text-left active:scale-[0.97] transition-transform"
                        >
                          <div className="relative aspect-square mb-2 overflow-hidden rounded-xl bg-white/5" style={{ boxShadow: '0 8px 22px rgba(0,0,0,0.55)' }}>
                            {t.cover_url ? (
                              <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Music className="w-8 h-8 text-white/30" /></div>
                            )}
                            <div className="absolute bottom-1.5 right-1.5 w-9 h-9 rounded-full bg-rose-500 shadow-lg flex items-center justify-center">
                              {resolvingId === t.id
                                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                : <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />}
                            </div>
                          </div>
                          <p className={`truncate text-[13px] font-bold leading-tight ${active ? 'text-rose-400' : 'text-white'}`}>{t.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-white/50">{t.artist}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ───── Top Artists ───── */}
              <div className="px-3 pt-7">
                <ArtistsRail />
              </div>

              {/* ───── Made For You — gradient mixes ───── */}
              {mixes.length > 0 && (
                <section className="pt-7">
                  <div className="px-3">
                    <SectionTitle eyebrow="Personal" title="Made for you" />
                  </div>
                  <div
                    className="flex gap-3 overflow-x-auto hide-scrollbar px-3 pb-1 mt-3 snap-x"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {mixes.map((m) => (
                      <MixGradientCard
                        key={m.id}
                        mix={m}
                        onPlay={() => {
                          if (m.songs.length > 0) playSong(m.songs[0], undefined, m.songs);
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ───── Fresh Drops ───── */}
              {freshDrops.length > 0 && (
                <section className="pt-7">
                  <div className="px-3">
                    <SectionTitle
                      eyebrow="Just in"
                      title="Fresh drops"
                      onSeeAll={() => navigate('/library')}
                    />
                  </div>
                  <div
                    className="flex gap-3 overflow-x-auto hide-scrollbar px-3 pb-1 mt-3 snap-x"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {freshDrops.map((s) => (
                      <DropCard
                        key={s.id}
                        song={s}
                        active={currentSong?.id === s.id}
                        onPlay={() => playSong(s, undefined, freshDrops)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ───── Viral global feed ───── */}
              <div className="px-3 pt-8">
                <GlobalTopTracksSection />
              </div>

              {/* Wordmark */}
              <div className="pt-8 pb-2 text-center">
                <p className="text-[10px] tracking-[0.5em] text-white/15 font-black">
                  UNIVERSFLOW
                </p>
              </div>
            </>
          )}
        </main>

        <BottomNav />
        {showLockScreen && <LockScreenPlayer isOpen={showLockScreen} onClose={() => setShowLockScreen(false)} />}
        {showQueue && <QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />}
        {showEqualizer && <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} />}
        <OfflineIndicator />
      </div>
    </TabTransition>
  );
};

/* ───────────── Section title ───────────── */
const SectionTitle = memo(({ eyebrow, title, onSeeAll }: {
  eyebrow?: string; title: string; onSeeAll?: () => void;
}) => (
  <div className="flex items-end justify-between gap-2">
    <div className="min-w-0">
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-[0.28em] text-rose-400/90 font-black">
          {eyebrow}
        </p>
      )}
      <h2 className="text-[22px] font-black tracking-tight text-white leading-tight mt-0.5">
        {title}
      </h2>
    </div>
    {onSeeAll && (
      <button
        onClick={() => { triggerHaptic('selection'); onSeeAll(); }}
        className="text-[11px] uppercase tracking-[0.2em] font-black text-white/55 active:text-white flex items-center gap-1"
      >
        All <ArrowUpRight className="w-3 h-3" />
      </button>
    )}
  </div>
));
SectionTitle.displayName = 'SectionTitle';

/* ───────────── Editorial Hero (full-bleed magazine card) ───────────── */
type HeroPick =
  | { type: 'trend'; t: IndexedTrack }
  | { type: 'song'; s: Song }
  | null;

const EditorialHero = memo(({ hero, isPlayingHero, onPlay }: {
  hero: HeroPick;
  isPlayingHero: boolean;
  onPlay: () => void;
}) => {
  if (!hero) return null;
  const title = hero.type === 'trend' ? hero.t.title : hero.s.title;
  const artist = hero.type === 'trend' ? hero.t.artist : hero.s.artist;
  const cover = hero.type === 'trend' ? hero.t.cover_url : hero.s.cover_url;
  const id = hero.type === 'trend' ? hero.t.id : hero.s.id;
  const [a, b] = colorFor(id || title);

  return (
    <div className="relative w-full px-3 pt-4">
      <div
        className="relative rounded-3xl overflow-hidden aspect-[4/5]"
        style={{
          background: `linear-gradient(180deg, ${a} 0%, ${b} 60%, #000 100%)`,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.85)',
        }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
        {/* Gradient scrim */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.92) 100%)',
          }}
        />

        {/* Eyebrow */}
        <div className="absolute top-4 left-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/15">
            <Sparkles className="w-3 h-3 text-white" />
            <span className="text-[10px] uppercase tracking-[0.22em] font-black text-white">
              Today's pick
            </span>
          </span>
        </div>

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="text-white text-[30px] font-black leading-[1.02] tracking-tight line-clamp-3">
            {title}
          </h2>
          <p className="text-white/80 text-[14px] font-semibold mt-1.5 truncate">
            {artist}
          </p>

          <div className="mt-4 flex items-center gap-2.5">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => { triggerHaptic('selection'); onPlay(); }}
              className="h-12 px-6 rounded-full bg-white text-black font-extrabold text-[14px] flex items-center gap-2 shadow-2xl"
            >
              {isPlayingHero
                ? <><Pause className="w-4 h-4" fill="currentColor" /> Pause</>
                : <><Play className="w-4 h-4 ml-0.5" fill="currentColor" /> Play</>}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
});
EditorialHero.displayName = 'EditorialHero';

/* ───────────── Drop Card ───────────── */
const DropCard = memo(({ song, active, onPlay }: {
  song: Song; active: boolean; onPlay: () => void;
}) => (
  <button
    type="button"
    onClick={() => { triggerHaptic('selection'); onPlay(); }}
    className="group flex-shrink-0 w-[140px] snap-start text-left active:scale-[0.97] transition-transform"
  >
    <div
      className="relative aspect-square mb-2 overflow-hidden rounded-xl bg-white/5"
      style={{ boxShadow: '0 8px 22px rgba(0,0,0,0.55)' }}
    >
      {song.cover_url ? (
        <img
          src={song.cover_url}
          alt={song.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Music className="w-8 h-8 text-white/30" />
        </div>
      )}
      <div className="absolute bottom-1.5 right-1.5 w-9 h-9 rounded-full bg-rose-500 shadow-lg flex items-center justify-center">
        <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
      </div>
    </div>
    <p className={`truncate text-[13px] font-bold leading-tight ${active ? 'text-rose-400' : 'text-white'}`}>
      {song.title}
    </p>
    <p className="mt-0.5 truncate text-[11px] text-white/50">{song.artist}</p>
  </button>
));
DropCard.displayName = 'DropCard';

/* ───────────── Mix Gradient Card ───────────── */
type Mix = { id: string; label: string; subtitle: string; songs: Song[]; cover?: string };

const MixGradientCard = memo(({ mix, onPlay }: { mix: Mix; onPlay: () => void }) => {
  const [a, b] = colorFor(mix.id);
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic('selection'); onPlay(); }}
      className="group flex-shrink-0 w-[170px] snap-start text-left active:scale-[0.97] transition-transform"
    >
      <div
        className="relative aspect-square mb-2 overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(140deg, ${a} 0%, ${b} 100%)`,
          boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
        }}
      >
        {mix.cover && (
          <img
            src={mix.cover}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/95">
            Mix
          </p>
          <div>
            <p className="text-white text-[20px] font-black leading-none tracking-tight line-clamp-2">
              {mix.label}
            </p>
            <p className="text-white/80 text-[10px] font-semibold mt-1.5 truncate">
              {mix.songs.length} songs
            </p>
          </div>
        </div>
        <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white flex items-center justify-center">
          <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
        </div>
      </div>
      <p className="truncate text-[12px] font-bold text-white">{mix.label}</p>
      <p className="mt-0.5 truncate text-[11px] text-white/50">{mix.subtitle}</p>
    </button>
  );
});
MixGradientCard.displayName = 'MixGradientCard';

/* ───────────── Mix builder ───────────── */
function buildMixes(songs: Song[]): Mix[] {
  if (!songs || songs.length < 4) return [];
  const buckets = new Map<string, Song[]>();
  for (const s of songs) {
    const key = (s.genre || s.mood || '').trim();
    if (!key) continue;
    const arr = buckets.get(key) || [];
    arr.push(s);
    buckets.set(key, arr);
  }
  const sorted = Array.from(buckets.entries())
    .filter(([, arr]) => arr.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  const mixes: Mix[] = [];
  mixes.push({
    id: 'daily',
    label: 'Daily Mix',
    subtitle: 'Fresh picks for today',
    songs: songs.slice(0, 30),
    cover: songs.find((s) => s.cover_url)?.cover_url,
  });

  for (const [key, arr] of sorted) {
    mixes.push({
      id: `mix-${key}`,
      label: key,
      subtitle: `${arr[0]?.artist || ''}${arr[1] ? ', ' + arr[1].artist : ''} & more`,
      songs: arr.slice(0, 30),
      cover: arr.find((s) => s.cover_url)?.cover_url,
    });
  }

  return mixes;
}

export default Home;
