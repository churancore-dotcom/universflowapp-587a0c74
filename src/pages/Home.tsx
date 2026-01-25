import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useNewSongNotification } from '@/hooks/useNewSongNotification';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSongCache } from '@/hooks/useSongCache';
import SongCard from '@/components/SongCard';
import HorizontalSection from '@/components/HorizontalSection';
import FavoritesWidget from '@/components/FavoritesWidget';
import RecentlyPlayedSection from '@/components/RecentlyPlayedSection';
import TopChartsSection from '@/components/TopChartsSection';
import FeaturedArtistsSection from '@/components/FeaturedArtistsSection';
import SleepTimerModal from '@/components/SleepTimerModal';
import QueueDrawer from '@/components/QueueDrawer';
import PullToRefreshIndicator from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import LockScreenPlayer from '@/components/LockScreenPlayer';
import EqualizerModal from '@/components/EqualizerModal';
import AudioVisualizer from '@/components/AudioVisualizer';
import AIPlaylistGenerator from '@/components/AIPlaylistGenerator';
import OfflineIndicator from '@/components/OfflineIndicator';
import OfflineSection from '@/components/OfflineSection';
import { TabTransition } from '@/components/PageTransition';
import { Sparkles, Music, Lock, Bell, Moon, ListMusic, Sliders, Waves, Wand2 } from 'lucide-react';
import { iosSpring, staggerContainer } from '@/lib/animations';
import { toast } from 'sonner';

// Memoized empty state component
const EmptyState = memo(() => (
  <motion.div
    className="text-center py-16 sm:py-20"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={iosSpring}
  >
    <motion.div 
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6"
      style={{
        background: 'linear-gradient(135deg, hsl(211 100% 50% / 0.2), hsl(328 100% 54% / 0.2))',
      }}
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ ...iosSpring, delay: 0.1 }}
    >
      <Music className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground" />
    </motion.div>
    <motion.h2 
      className="text-lg sm:text-xl font-semibold mb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      No music yet
    </motion.h2>
    <motion.p 
      className="text-muted-foreground max-w-xs mx-auto text-sm sm:text-[15px] px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      Music will appear here once an admin uploads songs to the platform.
    </motion.p>
  </motion.div>
));

EmptyState.displayName = 'EmptyState';

// Loading skeleton
const LoadingSkeleton = memo(() => (
  <motion.div 
    className="flex justify-center py-16 sm:py-20"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <motion.div 
      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary border-t-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  </motion.div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

const Home = () => {
  const { user } = useAuth();
  const { currentSong } = usePlayer();
  const { requestPermission } = useNewSongNotification();
  const { cachedSongs, updateCache } = useSongCache();
  const [songs, setSongs] = useState<Song[]>(cachedSongs || []);
  const [loading, setLoading] = useState(!cachedSongs);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showAIPlaylist, setShowAIPlaylist] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Memoized filtered songs
  const newReleases = useMemo(() => 
    songs.filter(s => (s as any).show_in_new_releases).slice(0, 10),
    [songs]
  );
  
  const trendingSongs = useMemo(() => 
    songs.filter(s => (s as any).show_in_trending).slice(0, 8),
    [songs]
  );
  
  const recommendedSongs = useMemo(() => 
    songs.slice().reverse().slice(0, 8),
    [songs]
  );

  useEffect(() => {
    fetchSongs();
    checkNotificationPermission();

    const channel = supabase
      .channel('songs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, fetchSongs)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success('Notifications enabled! 🔔');
    } else {
      toast.error('Notifications were denied');
    }
  };

  const fetchSongs = useCallback(async () => {
    const { data } = await supabase
      .from('songs')
      .select('*, artists(id, name, photo_url)')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

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
    setLoading(false);
  }, [updateCache]);

  const handleRefresh = useCallback(async () => {
    await fetchSongs();
    toast.success('Refreshed! 🔄');
  }, [fetchSongs]);

  const { pullDistance, isRefreshing, progress, isTriggered, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <TabTransition>
      <motion.div 
        className="min-h-screen bg-black pb-52 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={iosSpring}
        {...handlers}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {/* Dynamic gradient background that responds to current song */}
        <div className="absolute inset-0 pointer-events-none">
          {currentSong?.cover_url && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.5 }}
            >
              <img
                src={currentSong.cover_url}
                alt=""
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] blur-[120px] opacity-[0.15] saturate-150"
                style={{ height: '60%' }}
              />
            </motion.div>
          )}
          {/* Mesh gradient overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% 0%, hsl(220 100% 60% / 0.08), transparent),
                radial-gradient(ellipse 60% 40% at 80% 20%, hsl(330 100% 60% / 0.06), transparent),
                radial-gradient(ellipse 50% 30% at 20% 30%, hsl(270 100% 60% / 0.05), transparent)
              `,
            }}
          />
        </div>

        {/* Pull to refresh indicator */}
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
          progress={progress}
          isTriggered={isTriggered}
        />

        {/* iOS-style header with blur */}
        <motion.header
          className="sticky top-0 z-30 px-6 py-4 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.08)',
          }}
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={iosSpring}
        >
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...iosSpring, delay: 0.1 }}
            >
              <p className="text-[13px] text-muted-foreground font-medium">{greeting()}</p>
              <h1 className="text-[22px] font-bold tracking-tight">{user?.email?.split('@')[0] || 'Music Lover'}</h1>
            </motion.div>
            <div className="flex items-center gap-2">
              {/* AI DJ button */}
              <motion.button
                onClick={() => setShowAIPlaylist(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, hsl(280 100% 60%), hsl(320 100% 55%))',
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={iosSpring}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Wand2 className="w-5 h-5 text-white" />
              </motion.button>

              {/* Queue button */}
              <motion.button
                onClick={() => setShowQueue(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center glass"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={iosSpring}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <ListMusic className="w-5 h-5 text-white/80" />
              </motion.button>

              {currentSong && (
                <>
                  {/* Equalizer button */}
                  <motion.button
                    onClick={() => setShowEqualizer(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center glass"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    transition={iosSpring}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Sliders className="w-5 h-5 text-white/80" />
                  </motion.button>

                  {/* Visualizer button */}
                  <motion.button
                    onClick={() => setShowVisualizer(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center glass"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    transition={iosSpring}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Waves className="w-5 h-5 text-white/80" />
                  </motion.button>

                  {/* Lock Screen button */}
                  <motion.button
                    onClick={() => setShowLockScreen(true)}
                    className="w-10 h-10 rounded-full flex items-center justify-center glass"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    transition={iosSpring}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Lock className="w-5 h-5 text-white/80" />
                  </motion.button>
                </>
              )}

              {/* Sleep timer button */}
              <motion.button
                onClick={() => setShowSleepTimer(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center glass"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={iosSpring}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Moon className="w-5 h-5 text-white/80" />
              </motion.button>

              {!notificationsEnabled && (
                <motion.button
                  onClick={handleEnableNotifications}
                  className="w-10 h-10 rounded-full flex items-center justify-center glass"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={iosSpring}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Bell className="w-5 h-5 text-white/80" />
                </motion.button>
              )}
            </div>
          </div>
        </motion.header>

        <main className="px-4 sm:px-6 pt-6 sm:pt-8 relative z-10 overflow-x-hidden">
          {loading ? (
            <LoadingSkeleton />
          ) : songs.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-6 sm:space-y-8"
            >
              {/* Offline Section - Shows when offline or has downloads */}
              <OfflineSection isOffline={isOffline} />

              {/* New Releases - TOP PRIORITY */}
              {newReleases.length > 0 && (
                <HorizontalSection title="New Releases" subtitle="Fresh tracks just added" songs={newReleases}>
                  {newReleases.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} />
                  ))}
                </HorizontalSection>
              )}

              {/* Recommended for You - 2nd priority */}
              {songs.length > 3 && (
                <HorizontalSection title="Recommended for You" subtitle="Based on your taste" songs={recommendedSongs}>
                  {recommendedSongs.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} />
                  ))}
                </HorizontalSection>
              )}

              {/* Top Charts */}
              <TopChartsSection />

              {/* Recently Played */}
              <RecentlyPlayedSection />

              {/* Featured Artists */}
              <FeaturedArtistsSection />

              {/* Favorites Widget */}
              <FavoritesWidget />

              {/* Trending Now */}
              {trendingSongs.length > 0 && (
                <HorizontalSection title="Trending Now" subtitle="What's hot right now" songs={trendingSongs}>
                  {trendingSongs.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} />
                  ))}
                </HorizontalSection>
              )}
            </motion.div>
          )}
        </main>

        <BottomNav />
        <MiniPlayer />
        <FullscreenPlayer />
        {showLockScreen && <LockScreenPlayer isOpen={showLockScreen} onClose={() => setShowLockScreen(false)} />}
        {showSleepTimer && <SleepTimerModal isOpen={showSleepTimer} onClose={() => setShowSleepTimer(false)} />}
        {showQueue && <QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />}
        {showEqualizer && <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} audioContext={null} sourceNode={null} />}
        {showVisualizer && <AudioVisualizer isOpen={showVisualizer} onClose={() => setShowVisualizer(false)} />}
        {showAIPlaylist && <AIPlaylistGenerator isOpen={showAIPlaylist} onClose={() => setShowAIPlaylist(false)} onPlaylistCreated={fetchSongs} />}
        <OfflineIndicator />
      </motion.div>
    </TabTransition>
  );
};

export default Home;
