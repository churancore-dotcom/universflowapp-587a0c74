import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useSongCache } from '@/hooks/useSongCache';
import { useAuth } from '@/contexts/AuthContext';
import { useDownloads } from '@/contexts/DownloadContext';

import AllSongsSection from '@/components/AllSongsSection';
import GlobalTopTracksSection from '@/components/GlobalTopTracksSection';
import FollowedArtistSongsSection from '@/components/FollowedArtistSongsSection';
import QuickPicksGrid from '@/components/QuickPicksGrid';
import ArtistsRail from '@/components/home/ArtistsRail';
import ViralByCountrySection from '@/components/home/ViralByCountrySection';
import SleepTimerModal from '@/components/SleepTimerModal';
import QueueDrawer from '@/components/QueueDrawer';
import BottomNav from '@/components/BottomNav';
import LockScreenPlayer from '@/components/LockScreenPlayer';
import EqualizerModal from '@/components/EqualizerModal';
import OfflineIndicator from '@/components/OfflineIndicator';
import { TabTransition } from '@/components/PageTransition';
import { Music, Lock, ListMusic, Sliders, Search, Play, Pause, Sparkles, Flame, Heart, Radio, Headphones } from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptics';
import appLogo from '@/assets/app-logo.png';
import { HomeSkeleton } from '@/components/PageSkeletons';

const EmptyState = memo(() => (
  <div className="text-center py-12">
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
      style={{ background: 'linear-gradient(135deg, hsl(350 100% 60% / 0.25), hsl(280 100% 65% / 0.2))' }}
    >
      <Music className="w-9 h-9 text-foreground/70" />
    </div>
    <h2 className="text-lg font-bold mb-1">No music yet</h2>
    <p className="text-muted-foreground text-xs px-4">Music will appear here once uploaded.</p>
  </div>
));
EmptyState.displayName = 'EmptyState';

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

const MOOD_CHIPS = [
  { label: 'Pop', tag: 'pop', gradient: 'from-pink-500/30 to-rose-500/20' },
  { label: 'Hip-Hop', tag: 'hip-hop', gradient: 'from-amber-500/30 to-orange-500/20' },
  { label: 'Bollywood', tag: 'bollywood', gradient: 'from-fuchsia-500/30 to-pink-500/20' },
  { label: 'Chill', tag: 'chill', gradient: 'from-cyan-500/30 to-blue-500/20' },
  { label: 'Workout', tag: 'workout', gradient: 'from-red-500/30 to-rose-500/20' },
  { label: 'Lo-Fi', tag: 'lo-fi', gradient: 'from-violet-500/30 to-purple-500/20' },
  { label: 'K-Pop', tag: 'k-pop', gradient: 'from-purple-500/30 to-pink-500/20' },
  { label: 'Electronic', tag: 'electronic', gradient: 'from-emerald-500/30 to-teal-500/20' },
];

const Home = () => {
  const navigate = useNavigate();
  const { currentSong, isPlaying, togglePlay, playSong } = usePlayer();
  const { cachedSongs, updateCache } = useSongCache();
  const { isOffline, user } = useAuth() as any;
  const { downloads } = useDownloads();
  const queryClient = useQueryClient();
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
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
  const allSongs = useMemo(() => songs, [songs]);

  // Realtime: DIFF-based cache patch — only mutate the affected row instead of refetching
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

  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = useMemo(() => {
    const meta = (user?.user_metadata || {}) as any;
    return (meta.username || meta.full_name || (user?.email ? String(user.email).split('@')[0] : '')) || '';
  }, [user]);

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background relative flex flex-col overflow-hidden">
        {/* Cinematic ambient background — driven by current cover */}
        <div className="absolute inset-0 pointer-events-none">
          {currentSong?.cover_url && (
            <img
              src={currentSong.cover_url}
              alt=""
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[260%] blur-[140px] opacity-[0.18] saturate-[1.6]"
              style={{ height: '70%' }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 90% 55% at 50% 0%, hsl(350 100% 60% / 0.10), transparent 70%),
                radial-gradient(ellipse 70% 40% at 90% 25%, hsl(280 100% 65% / 0.07), transparent 70%),
                radial-gradient(ellipse 50% 35% at 5% 65%, hsl(210 100% 60% / 0.06), transparent 70%)
              `,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-40"
            style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--background)) 80%)' }}
          />
        </div>

        {/* Glassy header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-3 safe-area-pt"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => { triggerHaptic('selection'); navigate('/profile'); }}
                className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 active:scale-95 transition-transform"
                style={{ boxShadow: '0 2px 14px hsl(var(--primary) / 0.3)', border: '1.5px solid hsl(var(--primary) / 0.35)' }}
              >
                <img src={appLogo} alt="UniversFlow" className="w-full h-full object-cover" />
              </button>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-foreground tracking-tight leading-tight truncate">
                  {greeting()}{userName ? `, ${userName}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground/60 font-medium tracking-wide truncate">
                  What do you want to hear today?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { icon: Search, action: () => navigate('/search') },
                { icon: ListMusic, action: () => setShowQueue(true) },
                { icon: Sliders, action: () => setShowEqualizer(true) },
                { icon: Lock, action: () => setShowLockScreen(true) },
              ].map(({ icon: Icon, action }, i) => (
                <motion.button
                  key={i}
                  onClick={() => { triggerHaptic('selection'); action(); }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)' }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Icon className="w-4 h-4 text-foreground/70" />
                </motion.button>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-36 relative z-10"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            <HomeSkeleton />
          ) : isOffline && songs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-7">
              {!isOffline && (
                <>
                  {/* Continue Listening — appears only when there is a current song */}
                  {currentSong && (
                    <ContinueListeningCard
                      song={currentSong}
                      isPlaying={isPlaying}
                      onToggle={() => { triggerHaptic('selection'); togglePlay(); }}
                      onOpen={() => navigate('/player')}
                    />
                  )}

                  {/* Quick action tiles */}
                  <QuickActionsRow navigate={navigate} />

                  {/* Mood chips */}
                  <MoodChipsRow onPick={(tag) => navigate(`/search?q=${encodeURIComponent(tag)}`)} />

                  {/* Featured artists */}
                  <ArtistsRail />

                  {/* Quick Picks */}
                  <QuickPicksGrid />

                  {/* Viral / regional charts */}
                  <ViralByCountrySection />

                  {/* From artists you follow */}
                  <FollowedArtistSongsSection songs={allSongs} />

                  {/* Trending feed (hero #1 + ranked rows) */}
                  <GlobalTopTracksSection />

                  {/* Footer wordmark */}
                  <div className="pt-6 pb-2 text-center">
                    <p className="text-[10px] tracking-[0.4em] text-muted-foreground/40 font-bold">
                      UNIVERSFLOW
                    </p>
                  </div>
                </>
              )}

              {isOffline && allSongs.length > 0 && <AllSongsSection songs={allSongs} />}
            </div>
          )}
        </main>

        <BottomNav />
        {showLockScreen && <LockScreenPlayer isOpen={showLockScreen} onClose={() => setShowLockScreen(false)} />}
        {showSleepTimer && <SleepTimerModal isOpen={showSleepTimer} onClose={() => setShowSleepTimer(false)} />}
        {showQueue && <QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />}
        {showEqualizer && <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} />}
        <OfflineIndicator />
      </div>
    </TabTransition>
  );
};

/* ---------- Continue Listening ---------- */
const ContinueListeningCard = memo(({ song, isPlaying, onToggle, onOpen }: {
  song: Song; isPlaying: boolean; onToggle: () => void; onOpen: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className="relative overflow-hidden rounded-3xl"
    style={{ boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6)' }}
  >
    {/* Cover blurred backdrop */}
    {song.cover_url && (
      <img
        src={song.cover_url}
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-2xl scale-150 opacity-70"
      />
    )}
    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.75))' }} />
    <div className="relative p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onOpen}
        className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-muted active:scale-95 transition-transform"
        style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }}
      >
        {song.cover_url ? (
          <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-white/70" /></div>
        )}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 mb-1">
          <Headphones className="w-3 h-3 text-primary" />
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-primary uppercase">Continue Listening</p>
        </div>
        <p className="text-white text-[15px] font-bold leading-tight truncate" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
          {song.title}
        </p>
        <p className="text-white/70 text-[12px] font-semibold truncate mt-0.5">{song.artist}</p>
      </button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
        style={{ boxShadow: '0 8px 20px hsl(var(--primary) / 0.5)' }}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-primary-foreground" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
        )}
      </motion.button>
    </div>
  </motion.div>
));
ContinueListeningCard.displayName = 'ContinueListeningCard';

/* ---------- Quick action tiles ---------- */
const QuickActionsRow = memo(({ navigate }: { navigate: (p: string) => void }) => {
  const items = [
    { label: 'Liked Songs', icon: Heart, to: '/library', gradient: 'linear-gradient(135deg, hsl(350 100% 60%), hsl(330 100% 50%))' },
    { label: 'Trending', icon: Flame, to: '/search?q=trending', gradient: 'linear-gradient(135deg, hsl(20 100% 55%), hsl(0 100% 55%))' },
    { label: 'Discover', icon: Sparkles, to: '/search', gradient: 'linear-gradient(135deg, hsl(280 100% 60%), hsl(250 100% 60%))' },
    { label: 'Radio', icon: Radio, to: '/library', gradient: 'linear-gradient(135deg, hsl(200 100% 55%), hsl(180 100% 45%))' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 px-1">
      {items.map(({ label, icon: Icon, to, gradient }) => (
        <motion.button
          key={label}
          whileTap={{ scale: 0.97 }}
          onClick={() => { triggerHaptic('selection'); navigate(to); }}
          className="relative flex items-center gap-2.5 rounded-2xl overflow-hidden p-2.5 pr-3"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: gradient, boxShadow: '0 6px 16px rgba(0,0,0,0.3)' }}
          >
            <Icon className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <span className="text-[13px] font-bold text-foreground tracking-tight truncate">{label}</span>
        </motion.button>
      ))}
    </div>
  );
});
QuickActionsRow.displayName = 'QuickActionsRow';

/* ---------- Mood chips ---------- */
const MoodChipsRow = memo(({ onPick }: { onPick: (tag: string) => void }) => (
  <div className="space-y-2 px-1">
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-primary" />
      <h3 className="text-[14px] font-extrabold tracking-tight text-foreground">Browse Moods</h3>
    </div>
    <div
      className="flex gap-2 overflow-x-auto hide-scrollbar -mx-3 px-3 pb-1"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {MOOD_CHIPS.map((m) => (
        <motion.button
          key={m.tag}
          whileTap={{ scale: 0.94 }}
          onClick={() => { triggerHaptic('selection'); onPick(m.tag); }}
          className={`flex-shrink-0 px-4 py-2 rounded-full bg-gradient-to-br ${m.gradient}`}
          style={{ border: '0.5px solid rgba(255,255,255,0.10)' }}
        >
          <span className="text-[12px] font-bold text-foreground tracking-tight">{m.label}</span>
        </motion.button>
      ))}
    </div>
  </div>
));
MoodChipsRow.displayName = 'MoodChipsRow';

export default Home;
