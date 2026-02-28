import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useSongCache } from '@/hooks/useSongCache';
import SongCard from '@/components/SongCard';
import HorizontalSection from '@/components/HorizontalSection';
import AllSongsSection from '@/components/AllSongsSection';
import FeaturedArtistsSection from '@/components/FeaturedArtistsSection';
import SleepTimerModal from '@/components/SleepTimerModal';
import QueueDrawer from '@/components/QueueDrawer';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import LockScreenPlayer from '@/components/LockScreenPlayer';
import EqualizerModal from '@/components/EqualizerModal';
import OfflineIndicator from '@/components/OfflineIndicator';
import { TabTransition } from '@/components/PageTransition';
import { Music, Lock, ListMusic, Sliders, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';
import appLogo from '@/assets/app-logo.png';
import { HomeSkeleton } from '@/components/PageSkeletons';

// Simple empty state
const EmptyState = memo(() => (
  <div className="text-center py-8">
    <div 
      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
      style={{
        background: 'linear-gradient(135deg, hsl(211 100% 50% / 0.2), hsl(328 100% 54% / 0.2))',
      }}
    >
      <Music className="w-8 h-8 text-muted-foreground" />
    </div>
    <h2 className="text-base font-semibold mb-1">No music yet</h2>
    <p className="text-muted-foreground text-xs px-4">
      Music will appear here once uploaded.
    </p>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Simple loading
const LoadingSkeleton = memo(() => (
  <div className="flex justify-center py-8">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

const Home = () => {
  const { user } = useAuth();
  const { currentSong } = usePlayer();
  const { cachedSongs, updateCache } = useSongCache();
  const [songs, setSongs] = useState<Song[]>(cachedSongs || []);
  const [loading, setLoading] = useState(!cachedSongs);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);

  const newReleases = useMemo(() => 
    songs.filter(s => (s as any).show_in_new_releases).slice(0, 10),
    [songs]
  );

  const allSongs = useMemo(() => songs, [songs]);

  // Debounced real-time refetch to prevent query storms with 2000+ users
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSongs();

    const channel = supabase
      .channel('songs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        // Debounce: wait 2s after last change before refetching
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchSongs, 2000);
      })
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSongs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*, artists(id, name, photo_url)')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (data) {
        const mappedSongs = data.map(s => {
          const artistData = s.artists as { id: string; name: string; photo_url: string | null } | null;
          return {
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album || undefined,
            cover_url: s.cover_url || undefined,
            audio_url: s.audio_url,
            duration: s.duration || undefined,
            artist_id: artistData?.id || s.artist_id || undefined,
            artist_photo_url: artistData?.photo_url || undefined,
            show_in_new_releases: (s as any).show_in_new_releases,
            show_in_trending: (s as any).show_in_trending,
            is_premium_only: (s as any).is_premium_only,
          };
        });
        setSongs(mappedSongs);
        updateCache(mappedSongs);
      }
    } catch (err) {
      console.error('Failed to fetch songs:', err);
    }
    setLoading(false);
  }, [updateCache]);



  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <TabTransition>
      <div className="h-[100dvh] bg-background relative flex flex-col overflow-hidden">
        {/* Ambient background — cinematic */}
        <div className="absolute inset-0 pointer-events-none">
          {currentSong?.cover_url && (
            <img
              src={currentSong.cover_url}
              alt=""
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[250%] blur-[120px] opacity-[0.12] saturate-150"
              style={{ height: '60%' }}
            />
          )}
          <div 
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% 0%, hsl(350 100% 60% / 0.08), transparent),
                radial-gradient(ellipse 60% 40% at 80% 20%, hsl(280 100% 65% / 0.05), transparent),
                radial-gradient(ellipse 40% 30% at 10% 60%, hsl(210 100% 60% / 0.04), transparent)
              `,
            }}
          />
        </div>

        {/* Premium Header */}
        <header
          className="flex-shrink-0 z-30 px-4 pt-3 pb-3 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                style={{
                  boxShadow: '0 2px 12px hsl(var(--primary) / 0.25)',
                  border: '1.5px solid hsl(var(--primary) / 0.3)',
                }}
              >
                <img src={appLogo} alt="UniversFlow" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-[16px] font-bold text-foreground tracking-tight">{greeting()}</p>
                <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
                  {songs.length} tracks available
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {[
                { icon: ListMusic, action: () => setShowQueue(true) },
                { icon: Sliders, action: () => setShowEqualizer(true) },
                { icon: Lock, action: () => setShowLockScreen(true) },
              ].map(({ icon: Icon, action }, i) => (
                <motion.button
                  key={i}
                  onClick={() => { triggerHaptic('selection'); action(); }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.10)',
                  }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Icon className="w-4 h-4 text-foreground/60" />
                </motion.button>
              ))}
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-36 relative z-10"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
        {loading ? (
            <HomeSkeleton />
          ) : songs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {/* Hero Quick-Listen Banner */}
              {currentSong && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-3xl overflow-hidden relative"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '0.5px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                  }}
                >
                  {/* Album art background blur */}
                  {currentSong.cover_url && (
                    <img
                      src={currentSong.cover_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-25 blur-2xl saturate-150"
                    />
                  )}
                  <div className="relative flex items-center gap-3.5 p-4">
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                      style={{
                        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      {currentSong.cover_url ? (
                        <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                          <Headphones className="w-7 h-7 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10px] uppercase tracking-[0.15em] font-bold mb-1"
                        style={{ color: 'hsl(var(--primary))' }}
                      >
                        Now Playing
                      </p>
                      <p className="text-[15px] font-bold text-foreground truncate leading-tight">{currentSong.title}</p>
                      <p className="text-[12px] text-muted-foreground/60 truncate mt-0.5">{currentSong.artist}</p>
                    </div>
                    <div
                      className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1))',
                        border: '0.5px solid hsl(var(--primary) / 0.2)',
                      }}
                    >
                      <div className="flex items-end gap-[3px] h-4">
                        {[0, 1, 2, 3].map(i => (
                          <div
                            key={i}
                            className="w-[3px] bg-primary rounded-full animate-audio-wave"
                            style={{ animationDelay: `${i * 0.12}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Featured Artists */}
              <FeaturedArtistsSection />

              {/* New Releases */}
              {newReleases.length > 0 && (
                <HorizontalSection title="New Releases" subtitle="Fresh tracks just dropped" songs={newReleases}>
                  {newReleases.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} sectionSongs={newReleases} />
                  ))}
                </HorizontalSection>
              )}

              {/* All Songs */}
              {allSongs.length > 0 && (
                <AllSongsSection songs={allSongs} />
              )}
            </div>
          )}
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
        {showLockScreen && <LockScreenPlayer isOpen={showLockScreen} onClose={() => setShowLockScreen(false)} />}
        {showSleepTimer && <SleepTimerModal isOpen={showSleepTimer} onClose={() => setShowSleepTimer(false)} />}
        {showQueue && <QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />}
        {showEqualizer && <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} audioContext={null} sourceNode={null} />}
        <OfflineIndicator />
      </div>
    </TabTransition>
  );
};

export default Home;
