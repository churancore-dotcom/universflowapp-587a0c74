import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { triggerHaptic } from '@/hooks/useHaptics';

// iOS-optimized spring for smooth, responsive animations
const iosSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.5,
};

// Apple Music style animated bars
const NowPlayingBars = memo(function NowPlayingBars({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-[14px] w-[14px]">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-rose-500 to-rose-400"
          animate={isPlaying ? {
            height: ['4px', '14px', '6px', '12px', '4px'],
          } : {
            height: '4px',
          }}
          transition={isPlaying ? {
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: [0.4, 0, 0.2, 1],
          } : {
            duration: 0.2,
          }}
        />
      ))}
    </div>
  );
});

const MiniPlayer = memo(function MiniPlayer() {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    audioElement,
    togglePlay,
    nextSong,
    stopSong,
    setExpanded
  } = usePlayer();

  // Real audio frequency visualization
  const { bassFrequency } = useAudioVisualizer(audioElement, isPlaying);

  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('impactMedium');
    try {
      togglePlay();
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  }, [togglePlay]);

  const handleNextSong = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('impactLight');
    try {
      nextSong();
    } catch (error) {
      console.error('Error skipping song:', error);
    }
  }, [nextSong]);

  const handleStopSong = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('impactLight');
    try {
      stopSong();
    } catch (error) {
      console.error('Error stopping song:', error);
    }
  }, [stopSong]);

  const handleExpand = useCallback(() => {
    triggerHaptic('impactLight');
    try {
      setExpanded(true);
    } catch (error) {
      console.error('Error expanding player:', error);
    }
  }, [setExpanded]);

  if (!currentSong) return null;

  const progressPercent = duration > 0 && isFinite(progress) && isFinite(duration) 
    ? (progress / duration) * 100 
    : 0;

  // Real-time glow intensity based on bass
  const glowIntensity = bassFrequency * 0.6;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-[56px] left-0 right-0 z-40 px-2"
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        {/* Spotify-style sticky player */}
        <motion.div
          className="rounded-xl overflow-hidden bg-muted/95"
          style={{
            backdropFilter: 'blur(60px) saturate(200%)',
            WebkitBackdropFilter: 'blur(60px) saturate(200%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
          whileTap={{ scale: 0.99 }}
          onClick={handleExpand}
        >
          {/* Progress bar - thin red line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-t-xl">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>

          <div className="flex items-center gap-3 p-2">
            {/* Album Art with real frequency-reactive glow */}
            <div className="relative w-12 h-12 flex-shrink-0">
              {/* Real frequency-reactive glow behind artwork */}
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, rgba(250, 45, 72, ${0.4 + glowIntensity}) 0%, transparent 70%)`,
                  }}
                  animate={{
                    scale: 1 + bassFrequency * 0.4,
                    opacity: 0.5 + bassFrequency * 0.5,
                  }}
                  transition={{ duration: 0.05, ease: 'linear' }}
                />
              )}
              
              <motion.div 
                className="relative w-full h-full rounded-xl overflow-hidden shadow-lg z-10"
                animate={{
                  scale: isPlaying ? 1 + bassFrequency * 0.05 : 1,
                }}
                transition={{ duration: 0.05, ease: 'linear' }}
              >
                {currentSong.cover_url ? (
                  <img
                    src={currentSong.cover_url}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                    <NowPlayingBars isPlaying={isPlaying} />
                  </div>
                )}
                {isPlaying && currentSong.cover_url && (
                  <motion.div 
                    className="absolute inset-0 bg-black/30 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <NowPlayingBars isPlaying={isPlaying} />
                  </motion.div>
                )}
              </motion.div>
            </div>
            
            {/* Song info */}
            <div className="flex-1 min-w-0 pr-1">
              <motion.p 
                className="font-semibold text-[15px] text-white truncate leading-tight tracking-tight"
                layoutId="mini-title"
              >
                {currentSong.title}
              </motion.p>
              <p className="text-[13px] text-white/60 truncate mt-0.5">
                {currentSong.artist}
              </p>
            </div>

            {/* Controls - 48px touch targets with iOS animations */}
            <div className="flex items-center gap-0">
              {/* Play/Pause */}
              <motion.button
                className="w-12 h-12 min-w-[48px] rounded-full flex items-center justify-center"
                onClick={handleTogglePlay}
                whileTap={{ scale: 0.85 }}
                transition={iosSpring}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Pause className="w-6 h-6 text-white" fill="white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              
              {/* Next button */}
              <motion.button
                className="w-12 h-12 min-w-[48px] rounded-full flex items-center justify-center"
                onClick={handleNextSong}
                whileTap={{ scale: 0.85 }}
                transition={iosSpring}
                aria-label="Next song"
              >
                <SkipForward className="w-5 h-5 text-white" fill="white" />
              </motion.button>

              {/* Close button */}
              <motion.button
                className="w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center"
                onClick={handleStopSong}
                whileTap={{ scale: 0.85 }}
                transition={iosSpring}
                aria-label="Close player"
              >
                <X className="w-5 h-5 text-white/50" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default MiniPlayer;