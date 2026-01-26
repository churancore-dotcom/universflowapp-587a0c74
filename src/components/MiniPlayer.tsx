import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { triggerHaptic } from '@/hooks/useHaptics';

// Swipe thresholds
const SWIPE_UP_THRESHOLD = -50;
const SWIPE_HORIZONTAL_THRESHOLD = 80;

const MiniPlayer = memo(function MiniPlayer() {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    togglePlay,
    nextSong,
    prevSong,
    stopSong,
    setExpanded
  } = usePlayer();

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('impactMedium');
    togglePlay();
  }, [togglePlay]);

  const handleNextSong = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('impactLight');
    nextSong();
  }, [nextSong]);

  const handlePrevSong = useCallback(() => {
    triggerHaptic('impactLight');
    prevSong();
  }, [prevSong]);

  const handleStopSong = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('impactLight');
    stopSong();
  }, [stopSong]);

  const handleExpand = useCallback(() => {
    if (!isDragging) {
      triggerHaptic('impactLight');
      setExpanded(true);
    }
  }, [setExpanded, isDragging]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    setDragX(info.offset.x);
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    
    if (offset.y < SWIPE_UP_THRESHOLD || velocity.y < -300) {
      triggerHaptic('impactMedium');
      setExpanded(true);
    } else if (offset.x < -SWIPE_HORIZONTAL_THRESHOLD || velocity.x < -500) {
      handleNextSong();
    } else if (offset.x > SWIPE_HORIZONTAL_THRESHOLD || velocity.x > 500) {
      handlePrevSong();
    }

    setDragX(0);
    setTimeout(() => setIsDragging(false), 100);
  }, [setExpanded, handleNextSong, handlePrevSong]);

  if (!currentSong) return null;

  const progressPercent = duration > 0 && isFinite(progress) && isFinite(duration) 
    ? (progress / duration) * 100 
    : 0;

  const isSwipingLeft = dragX < -30;
  const isSwipingRight = dragX > 30;
  const swipeOpacity = Math.min(Math.abs(dragX) / 150, 0.5);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed left-0 right-0 w-full z-40 px-2"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        initial={{ y: 60, opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ y: 60, opacity: 0, scale: 0.98, filter: 'blur(5px)' }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 25,
          opacity: { duration: 0.3 },
          filter: { duration: 0.25 }
        }}
      >
        <motion.div
          className="rounded-xl overflow-hidden bg-muted/95 relative touch-manipulation"
          style={{
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
          drag
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={{ left: 0.3, right: 0.3, top: 0.2, bottom: 0 }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onClick={handleExpand}
          whileTap={{ scale: isDragging ? 1 : 0.99 }}
        >
          {/* Swipe hints */}
          {isSwipingLeft && (
            <div 
              className="absolute inset-y-0 right-2 flex items-center z-20 pointer-events-none"
              style={{ opacity: swipeOpacity }}
            >
              <div className="bg-primary/80 rounded-full px-3 py-1.5 text-xs font-semibold text-white">
                Next →
              </div>
            </div>
          )}
          {isSwipingRight && (
            <div 
              className="absolute inset-y-0 left-2 flex items-center z-20 pointer-events-none"
              style={{ opacity: swipeOpacity }}
            >
              <div className="bg-primary/80 rounded-full px-3 py-1.5 text-xs font-semibold text-white">
                ← Prev
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-t-xl">
            <div
              className="h-full bg-rose-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-3 p-2">
            {/* Album Art */}
            <div className="relative w-12 h-12 flex-shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden shadow-lg bg-muted">
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
                    <span className="text-white text-lg">♪</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Song info */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="font-semibold text-[15px] text-white truncate leading-tight">
                {currentSong.title}
              </p>
              <p className="text-[13px] text-white/60 truncate mt-0.5">
                {currentSong.artist}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-0">
              <button
                className="w-12 h-12 min-w-[48px] rounded-full flex items-center justify-center active:scale-90 transition-transform"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 text-white" fill="white" />
                ) : (
                  <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                )}
              </button>
              
              <button
                className="w-12 h-12 min-w-[48px] rounded-full flex items-center justify-center active:scale-90 transition-transform"
                onClick={handleNextSong}
                aria-label="Next song"
              >
                <SkipForward className="w-5 h-5 text-white" fill="white" />
              </button>

              <button
                className="w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center active:scale-90 transition-transform"
                onClick={handleStopSong}
                aria-label="Close player"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default MiniPlayer;
