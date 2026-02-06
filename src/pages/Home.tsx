import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Song, usePlayer } from '@/contexts/PlayerContext';
import { useSongCache } from '@/hooks/useSongCache';
import SongCard from '@/components/SongCard';
import HorizontalSection from '@/components/HorizontalSection';
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
import { Music, Lock, ListMusic, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptics';

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
    songs.filter(s => (s as any).show_in_new_releases).slice(0, 8),
    [songs]
  );
  
  const trendingSongs = useMemo(() => 
    songs.filter(s => (s as any).show_in_trending).slice(0, 6),
    [songs]
  );

  // All songs for the "All Songs" section
  const allSongs = useMemo(() => songs.slice(0, 20), [songs]);

  useEffect(() => {
    fetchSongs();

    const channel = supabase
      .channel('songs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, fetchSongs)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <TabTransition>
      <div 
        className="h-[100dvh] bg-black relative flex flex-col overflow-hidden"
      >
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          {currentSong?.cover_url && (
            <img
              src={currentSong.cover_url}
              alt=""
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] blur-[100px] opacity-[0.12]"
              style={{ height: '40%' }}
            />
          )}
          <div 
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% 0%, hsl(220 100% 60% / 0.06), transparent),
                radial-gradient(ellipse 60% 40% at 80% 20%, hsl(330 100% 60% / 0.04), transparent)
              `,
            }}
          />
        </div>

        {/* Header */}
        <header
          className="flex-shrink-0 z-30 px-3 py-2 safe-area-pt"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white/90 flex-shrink-0">{greeting()}</p>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setShowQueue(true);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center glass flex-shrink-0 active:scale-90 transition-transform"
              >
                <ListMusic className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setShowEqualizer(true);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center glass flex-shrink-0 active:scale-90 transition-transform"
              >
                <Sliders className="w-4 h-4 text-white/80" />
              </button>

              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setShowLockScreen(true);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center glass flex-shrink-0 active:scale-90 transition-transform"
              >
                <Lock className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable content area - calculated to fit exactly */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-3 pb-32 relative z-10"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading ? (
            <LoadingSkeleton />
          ) : songs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {newReleases.length > 0 && (
                <HorizontalSection title="New Releases" subtitle="Fresh tracks" songs={newReleases}>
                  {newReleases.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} sectionSongs={newReleases} />
                  ))}
                </HorizontalSection>
              )}

              <FeaturedArtistsSection />

              {trendingSongs.length > 0 && (
                <HorizontalSection title="Trending" subtitle="What's hot" songs={trendingSongs}>
                  {trendingSongs.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} sectionSongs={trendingSongs} />
                  ))}
                </HorizontalSection>
              )}

              {/* All Songs Section */}
              {allSongs.length > 0 && (
                <HorizontalSection title="All Songs" subtitle="Browse all music" songs={allSongs}>
                  {allSongs.map((song, i) => (
                    <SongCard key={song.id} song={song} index={i} sectionSongs={allSongs} />
                  ))}
                </HorizontalSection>
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