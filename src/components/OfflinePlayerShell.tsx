import { memo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Play, Music, HardDrive, Shuffle, Download } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useDownloads } from '@/contexts/DownloadContext';
import MiniPlayer from '@/components/MiniPlayer';
import FullscreenPlayer from '@/components/FullscreenPlayer';
import { triggerHaptic } from '@/hooks/useHaptics';
import { iosSpring, staggerContainer, staggerItem } from '@/lib/animations';
import appLogo from '@/assets/app-logo.png';

const OfflinePlayerShell = memo(function OfflinePlayerShell() {
  const { playSong, currentSong, isPlaying, setQueue } = usePlayer();
  const { downloads } = useDownloads();
  const [storageUsed, setStorageUsed] = useState('0 MB');

  const cachedSongs = downloads.map(d => ({
    id: d.id,
    title: d.title,
    artist: d.artist,
    cover_url: d.cover_url || undefined,
    audio_url: d.blobUrl || d.audio_url,
  }));

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        setStorageUsed(`${usedMB} MB`);
      });
    }
  }, []);

  const handlePlayAll = () => {
    if (cachedSongs.length > 0) {
      triggerHaptic('impactMedium');
      setQueue(cachedSongs as any);
      playSong(cachedSongs[0] as any, cachedSongs[0].audio_url, cachedSongs as any);
    }
  };

  const handleShufflePlay = () => {
    if (cachedSongs.length > 0) {
      triggerHaptic('impactMedium');
      const shuffled = [...cachedSongs].sort(() => Math.random() - 0.5);
      setQueue(shuffled as any);
      playSong(shuffled[0] as any, shuffled[0].audio_url, shuffled as any);
    }
  };

  const handlePlaySong = (song: typeof cachedSongs[0]) => {
    triggerHaptic('impactLight');
    playSong(song as any, song.audio_url, cachedSongs as any);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-40 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 bg-background/80 backdrop-blur-xl safe-area-pt">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-border/30">
            <img src={appLogo} alt="UniversFlow" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Offline Mode</h1>
            <p className="text-xs text-muted-foreground">
              {cachedSongs.length} songs • {storageUsed} used
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10">
            <WifiOff className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[11px] font-medium text-destructive">Offline</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 mt-2">
        {cachedSongs.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center py-20 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={iosSpring}
          >
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-5">
              <Download className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">No Downloaded Songs</h2>
            <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
              Connect to the internet and download songs first. Then you can listen offline without signing in.
            </p>
          </motion.div>
        ) : (
          <>
            {/* Play All Buttons */}
            <div className="flex gap-3 mb-5">
              <motion.button
                className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2"
                onClick={handlePlayAll}
                whileTap={{ scale: 0.97 }}
                transition={iosSpring}
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Play All
              </motion.button>
              <motion.button
                className="py-4 px-6 rounded-2xl bg-muted text-foreground font-semibold text-base flex items-center justify-center gap-2"
                onClick={handleShufflePlay}
                whileTap={{ scale: 0.97 }}
                transition={iosSpring}
              >
                <Shuffle className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Song List */}
            <motion.div
              className="space-y-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {cachedSongs.map((song) => (
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
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    {song.cover_url ? (
                      <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className={`font-semibold text-base truncate ${
                      currentSong?.id === song.id ? 'text-primary' : 'text-foreground'
                    }`}>
                      {song.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  {currentSong?.id === song.id && isPlaying && (
                    <div className="flex gap-0.5 items-end h-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-1 bg-primary rounded-full animate-pulse"
                          style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }}
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

      <MiniPlayer />
      <FullscreenPlayer />
    </div>
  );
});

export default OfflinePlayerShell;
