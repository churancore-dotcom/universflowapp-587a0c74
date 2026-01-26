import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Play, Music, HardDrive } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import BottomNav from '@/components/BottomNav';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import { triggerHaptic } from '@/hooks/useHaptics';
import { iosSpring, staggerContainer, staggerItem } from '@/lib/animations';

interface CachedSong {
  id: string;
  title: string;
  artist: string;
  cover_url?: string;
  audio_url: string;
}

const Offline = memo(function Offline() {
  const { playSong, currentSong, isPlaying, setQueue } = usePlayer();
  const { downloads } = useDownloads();
  const [cachedSongs, setCachedSongs] = useState<CachedSong[]>([]);
  const [storageUsed, setStorageUsed] = useState<string>('0 MB');

  useEffect(() => {
    // Load downloaded songs from context
    if (downloads && downloads.length > 0) {
      setCachedSongs(downloads.map(d => ({
        id: d.id,
        title: d.title,
        artist: d.artist,
        cover_url: d.cover_url || undefined,
        audio_url: d.blobUrl || d.audio_url,
      })));
    }

    // Calculate storage usage
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        setStorageUsed(`${usedMB} MB`);
      });
    }
  }, [downloads]);

  const handlePlayAll = () => {
    if (cachedSongs.length > 0) {
      triggerHaptic('impactMedium');
      setQueue(cachedSongs as any);
      playSong(cachedSongs[0] as any);
    }
  };

  const handlePlaySong = (song: CachedSong) => {
    triggerHaptic('impactLight');
    playSong(song as any);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-40 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Offline Mode</h1>
            <p className="text-sm text-muted-foreground">
              {cachedSongs.length} songs • {storageUsed} used
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4">
        {cachedSongs.length === 0 ? (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={iosSpring}
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <HardDrive className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No Downloaded Songs</h2>
            <p className="text-sm text-muted-foreground max-w-[260px]">
              Download songs while online to listen offline. Tap the download icon on any song.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Play All Button */}
            <motion.button
              className="w-full py-4 mb-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2"
              onClick={handlePlayAll}
              whileTap={{ scale: 0.97 }}
              transition={iosSpring}
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Play All ({cachedSongs.length})
            </motion.button>

            {/* Song List */}
            <motion.div
              className="space-y-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {cachedSongs.map((song, index) => (
                <motion.button
                  key={song.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors ${
                    currentSong?.id === song.id 
                      ? 'bg-primary/15' 
                      : 'bg-card active:bg-card/80'
                  }`}
                  onClick={() => handlePlaySong(song)}
                  variants={staggerItem}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Cover */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    {song.cover_url ? (
                      <img 
                        src={song.cover_url} 
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className={`font-semibold text-base truncate ${
                      currentSong?.id === song.id ? 'text-primary' : 'text-foreground'
                    }`}>
                      {song.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {song.artist}
                    </p>
                  </div>

                  {/* Playing Indicator */}
                  {currentSong?.id === song.id && isPlaying && (
                    <div className="flex gap-0.5 items-end h-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary rounded-full animate-equalizer"
                          style={{
                            height: '100%',
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <MiniPlayer />
      <FullscreenPlayer />
      <BottomNav />
    </div>
  );
});

export default Offline;
