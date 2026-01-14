import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useNewSongNotification } from '@/hooks/useNewSongNotification';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import SongCard from '@/components/SongCard';
import HorizontalSection from '@/components/HorizontalSection';
import FavoritesWidget from '@/components/FavoritesWidget';
import PullToRefreshIndicator from '@/components/PullToRefresh';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import LockScreenPlayer from '@/components/LockScreenPlayer';
import { TabTransition } from '@/components/PageTransition';
import { Sparkles, Music, Lock, Bell } from 'lucide-react';
import { iosSpring, staggerContainer } from '@/lib/animations';
import { toast } from 'sonner';

const Home = () => {
  const { user } = useAuth();
  const { currentSong } = usePlayer();
  const { requestPermission } = useNewSongNotification();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (data) {
      setSongs(data.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album || undefined,
        cover_url: s.cover_url || undefined,
        audio_url: s.audio_url,
        duration: s.duration || undefined,
      })));
    }
    setLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchSongs();
    toast.success('Refreshed! 🔄');
  }, [fetchSongs]);

  const { pullDistance, isRefreshing, progress, isTriggered, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const EmptyState = () => (
    <motion.div
      className="text-center py-20"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={iosSpring}
    >
      <motion.div 
        className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6"
        style={{
          background: 'linear-gradient(135deg, hsl(211 100% 50% / 0.2), hsl(328 100% 54% / 0.2))',
        }}
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...iosSpring, delay: 0.1 }}
      >
        <Music className="w-12 h-12 text-muted-foreground" />
      </motion.div>
      <motion.h2 
        className="text-xl font-semibold mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        No music yet
      </motion.h2>
      <motion.p 
        className="text-muted-foreground max-w-xs mx-auto text-[15px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Music will appear here once an admin uploads songs to the platform.
      </motion.p>
    </motion.div>
  );

  return (
    <TabTransition>
      <motion.div 
        className="min-h-screen bg-black pb-52 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={iosSpring}
        {...handlers}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
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
            {currentSong && (
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
            )}
            <motion.button
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(211 100% 50%), hsl(328 100% 54%))',
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={iosSpring}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <main className="px-6 pt-8">
        {loading ? (
          <motion.div 
            className="flex justify-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        ) : songs.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Favorites Widget */}
            <FavoritesWidget />

            <HorizontalSection title="New Releases" subtitle="Fresh tracks just added" songs={songs.slice(0, 10)}>
              {songs.slice(0, 10).map((song, i) => (
                <SongCard key={song.id} song={song} index={i} />
              ))}
            </HorizontalSection>

            {songs.length > 5 && (
              <HorizontalSection title="Trending Now" subtitle="What's hot right now" songs={songs.slice(0, 8)}>
                {songs.slice(0, 8).map((song, i) => (
                  <SongCard key={song.id} song={song} index={i} />
                ))}
              </HorizontalSection>
            )}

            {songs.length > 3 && (
              <HorizontalSection title="Recommended for You" subtitle="Based on your taste" songs={songs.slice().reverse().slice(0, 8)}>
                {songs.slice().reverse().slice(0, 8).map((song, i) => (
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
      <LockScreenPlayer isOpen={showLockScreen} onClose={() => setShowLockScreen(false)} />
      </motion.div>
    </TabTransition>
  );
};

export default Home;
