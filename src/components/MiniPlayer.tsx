import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { iosBounce } from '@/lib/animations';
import LikeButton from './LikeButton';

const MiniPlayer = memo(() => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    togglePlay,
    nextSong,
    stopSong,
    setExpanded
  } = usePlayer();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb"
        style={{
          background: 'rgba(18, 18, 18, 0.92)',
          backdropFilter: 'blur(50px) saturate(180%)',
          WebkitBackdropFilter: 'blur(50px) saturate(180%)',
        }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, hsl(211 100% 50%), hsl(328 100% 54%))',
            }}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          {/* Song info */}
          <motion.div
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onClick={() => setExpanded(true)}
            whileTap={{ scale: 0.98, opacity: 0.8 }}
            transition={iosBounce}
          >
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-muted/50 flex-shrink-0 shadow-lg">
              {currentSong.cover_url ? (
                <img
                  src={currentSong.cover_url}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/40" />
              )}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex items-end gap-[3px] h-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-[3px] bg-white rounded-full"
                        animate={{ height: [5, 14, 5] }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.12,
                          ease: "easeInOut",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="min-w-0">
              <p className="font-medium text-[15px] truncate leading-tight">
                {currentSong.title}
              </p>
              <p className="text-[13px] text-muted-foreground truncate mt-0.5">
                {currentSong.artist}
              </p>
            </div>
          </motion.div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <LikeButton songId={currentSong.id} size="sm" className="mr-1" />
            
            <motion.button
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-black shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              whileTap={{ scale: 0.88 }}
              transition={iosBounce}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="black" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="black" />
              )}
            </motion.button>
            
            <motion.button
              className="p-2.5 rounded-full flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                nextSong();
              }}
              whileTap={{ scale: 0.85 }}
              transition={iosBounce}
            >
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </motion.button>

            {/* Close/Stop button */}
            <motion.button
              className="p-2 rounded-full flex items-center justify-center text-muted-foreground hover:text-white ml-1"
              onClick={(e) => {
                e.stopPropagation();
                stopSong();
              }}
              whileTap={{ scale: 0.85 }}
              transition={iosBounce}
              aria-label="Close player"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
