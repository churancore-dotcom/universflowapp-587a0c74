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
  Music, Lock, ListMusic, Sliders, Search, Play, Pause, Sparkles, Flame,
  Headphones, Radio, Heart, Compass, ArrowUpRight,
} from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptics';
import appLogo from '@/assets/app-logo.png';
import { HomeSkeleton } from '@/components/PageSkeletons';

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

const MOODS: Array<{ label: string; q: string; icon: React.ComponentType<any> }> = [
  { label: 'Chill', q: 'chill', icon: Headphones },
  { label: 'Workout', q: 'workout', icon: Flame },
  { label: 'Focus', q: 'focus', icon: Compass },
  { label: 'Romance', q: 'romance', icon: Heart },
  { label: 'Party', q: 'party', icon: Sparkles },
  { label: 'Lo-fi', q: 'lofi', icon: Radio },
];

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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }, []);

  // Spotlight = first new release with cover
  const spotlight = useMemo(
    () => songs.find((s) => s.cover_url) || songs[0] || null,
    [songs]
  );
  // Top 30 trending (3 rows × 10) horizontal
  const trendingStrip = useMemo(
    () => songs.filter((s) => s.id !== spotlight?.id).slice(0, 30),
    [songs, spotlight]
  );
  // Fresh drops
  const freshDrops = useMemo(() => songs.slice(0, 12), [songs]);
  // Mixes
  const mixes = useMemo(() => buildMixes(songs), [songs]);

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
                  {greeting}
                </p>
                <p className="text-[15px] font-extrabold tracking-tight leading-tight truncate mt-1">
                  {userName || 'Welcome back'}
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
              {/* ───── HERO: Editorial spotlight ───── */}
              <SpotlightHero
                song={spotlight}
                isCurrent={!!spotlight && currentSong?.id === spotlight.id}
                isPlaying={isPlaying}
                onPlay={() => {
                  if (!spotlight) { navigate('/search'); return; }
                  if (currentSong?.id === spotlight.id) { togglePlay(); return; }
                  playSong(spotlight, undefined, songs);
                }}
                onOpen={() => {
                  if (!spotlight) return;
                  if (currentSong?.id !== spotlight.id) playSong(spotlight, undefined, songs);
                  setExpanded(true);
                }}
                onSearch={() => navigate('/search')}
              />

              {/* ───── Now playing dock (only if something is playing) ───── */}
              {currentSong && (
                <div className="px-3 pt-4">
                  <NowPlayingDock
                    song={currentSong}
                    isPlaying={isPlaying}
                    onToggle={() => { triggerHaptic('selection'); togglePlay(); }}
                    onExpand={() => { triggerHaptic('selection'); setExpanded(true); }}
                  />
                </div>
              )}

              {/* ───── Trending Now — 3 rows × 10, horizontal scroll ───── */}
              {trendingStrip.length > 0 && (
                <section className="pt-6">
                  <div className="px-3">
                    <SectionTitle
                      eyebrow="Charts"
                      title="Trending now"
                      onSeeAll={() => navigate('/library')}
                    />
                  </div>
                  <div
                    className="mt-3 overflow-x-auto hide-scrollbar pb-1"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    <div
                      className="grid grid-rows-3 grid-flow-col auto-cols-[78%] gap-x-3 gap-y-1.5 px-3"
                    >
                      {trendingStrip.map((s, i) => {
                        const active = currentSong?.id === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              triggerHaptic('selection');
                              if (active) togglePlay();
                              else playSong(s, undefined, trendingStrip);
                            }}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl active:bg-white/[0.05]"
                          >
                            <span className="w-6 text-center text-[16px] font-black text-white/40 tabular-nums flex-shrink-0">
                              {i + 1}
                            </span>
                            <div className="w-11 h-11 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
                              {s.cover_url ? (
                                <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-white/30" /></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className={`truncate text-[13px] font-bold leading-tight ${active ? 'text-rose-400' : 'text-white'}`}>{s.title}</p>
                              <p className="truncate text-[11px] text-white/50 mt-0.5">{s.artist}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                              {active && isPlaying
                                ? <Pause className="w-3.5 h-3.5 text-white" fill="currentColor" />
                                : <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

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

              {/* ───── Top Artists ───── */}
              <div className="px-3 pt-7">
                <ArtistsRail />
              </div>

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

/* ───────────── Spotlight Hero (editorial) ───────────── */
const SpotlightHero = memo(({ song, isCurrent, isPlaying, onPlay, onOpen, onSearch }: {
  song: Song | null;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onOpen: () => void;
  onSearch: () => void;
}) => {
  if (!song) return null;

  const [a, b] = colorFor(song.id || song.title);

  return (
    <div className="relative w-full px-4 pt-5 pb-2">
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${a} 0%, ${b} 75%, #000 100%)`,
          boxShadow: '0 20px 50px -20px rgba(0,0,0,0.8)',
        }}
      >
        {/* Backdrop blur of cover */}
        {song.cover_url && (
          <img
            src={song.cover_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-30"
            style={{ filter: 'blur(40px) saturate(1.4)' }}
          />
        )}
        <div className="relative p-5 pt-5">
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15">
              <Sparkles className="w-3 h-3 text-white" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-black text-white">
                Editor's pick
              </span>
            </span>
          </div>

          {/* Big tilted artwork */}
          <div className="flex justify-center mb-5">
            <button
              type="button"
              onClick={onOpen}
              className="relative active:scale-[0.97] transition-transform"
            >
              <div
                className="w-[200px] h-[200px] rounded-2xl overflow-hidden ring-1 ring-white/20"
                style={{
                  boxShadow: '0 25px 50px -10px rgba(0,0,0,0.8)',
                  transform: 'rotate(-3deg)',
                }}
              >
                {song.cover_url ? (
                  <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Music className="w-16 h-16 text-white/40" />
                  </div>
                )}
              </div>
            </button>
          </div>

          <div className="text-left">
            <h2 className="text-white text-[26px] font-black leading-[1.05] tracking-tight line-clamp-2">
              {song.title}
            </h2>
            <p className="text-white/75 text-[14px] font-semibold mt-1 truncate">
              {song.artist}
            </p>

            <div className="mt-4 flex items-center gap-2.5">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => { triggerHaptic('selection'); onPlay(); }}
                className="h-12 px-5 rounded-full bg-white text-black font-extrabold text-[14px] flex items-center gap-2 shadow-xl"
              >
                {isCurrent && isPlaying
                  ? <><Pause className="w-4 h-4" fill="currentColor" /> Pause</>
                  : <><Play className="w-4 h-4 ml-0.5" fill="currentColor" /> Play now</>}
              </motion.button>
              <button
                onClick={() => { triggerHaptic('selection'); onOpen(); }}
                className="h-12 w-12 rounded-full border border-white/30 bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
              >
                <ArrowUpRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
SpotlightHero.displayName = 'SpotlightHero';

/* ───────────── Now Playing dock ───────────── */
const NowPlayingDock = memo(({ song, isPlaying, onToggle, onExpand }: {
  song: Song; isPlaying: boolean; onToggle: () => void; onExpand: () => void;
}) => (
  <div
    className="relative rounded-2xl overflow-hidden border border-white/10 flex items-center gap-3 p-2 pr-3"
    style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
  >
    <button onClick={onExpand} className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 active:scale-95 transition-transform">
      {song.cover_url
        ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-white/40" /></div>}
    </button>
    <button onClick={onExpand} className="flex-1 min-w-0 text-left">
      <p className="text-[10px] uppercase tracking-[0.22em] text-rose-400 font-black">Now playing</p>
      <p className="text-[14px] font-bold text-white truncate leading-tight mt-0.5">{song.title}</p>
      <p className="text-[11px] text-white/55 truncate mt-0.5">{song.artist}</p>
    </button>
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onToggle}
      className="w-11 h-11 rounded-full bg-white flex items-center justify-center flex-shrink-0"
    >
      {isPlaying
        ? <Pause className="w-5 h-5 text-black" fill="currentColor" />
        : <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />}
    </motion.button>
  </div>
));
NowPlayingDock.displayName = 'NowPlayingDock';

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
