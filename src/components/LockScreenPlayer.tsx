import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { Slider } from '@/components/ui/slider';
import { setLockscreenOpen } from '@/lib/lockscreenState';
import { 
  Play, Pause, SkipBack, SkipForward, Music, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Lock
} from 'lucide-react';

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface LockScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wake Lock hook to prevent screen timeout
const useWakeLock = (enabled: boolean) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch (e) {
        console.warn('Wake Lock not supported or failed:', e);
      }
    };

    requestWakeLock();

    // Re-acquire on visibility change (e.g. tab switch back)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [enabled]);
};

const LockScreenPlayer = ({ isOpen, onClose }: LockScreenPlayerProps) => {
  const {
    currentSong, isPlaying, progress, duration, volume,
    shuffle, repeat, togglePlay, nextSong, prevSong,
    setVolume, toggleShuffle, toggleRepeat, seek,
  } = usePlayer();

  const [time, setTime] = useState(new Date());
  const dragY = useMotionValue(0);
  const dragOpacity = useTransform(dragY, [-200, 0], [0, 1]);

  // Keep screen awake
  useWakeLock(isOpen);

  // Hide MiniPlayer / mini overlays while lockscreen is visible
  useEffect(() => {
    setLockscreenOpen(isOpen);
    return () => setLockscreenOpen(false);
  }, [isOpen]);

  // Live clock
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y < -120) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col select-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
          {/* Background: blurred album art */}
          <div className="absolute inset-0">
            {currentSong.cover_url && (
              <motion.img
                key={currentSong.id}
                src={currentSong.cover_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1.05, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              />
            )}
            <div className="absolute inset-0 backdrop-blur-[80px] bg-black/50" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70" />
          </div>

          {/* Main content - swipe up to dismiss */}
          <motion.div
            className="relative z-10 flex flex-col h-full w-full max-w-[430px] mx-auto"
            style={{ opacity: dragOpacity }}
            drag="y"
            dragConstraints={{ top: -200, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
          >
            {/* Status bar area */}
            <div className="flex items-center justify-between px-6 pt-[env(safe-area-inset-top,12px)] pb-1">
              <Lock className="w-3.5 h-3.5 text-white/40" />
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-white/40" />
                <div className="w-1 h-1 rounded-full bg-white/40" />
                <div className="w-1 h-1 rounded-full bg-white/40" />
              </div>
            </div>

            {/* Clock - iOS style */}
            <motion.div
              className="text-center mt-4 mb-2"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="text-[72px] leading-none font-thin text-white tracking-tight tabular-nums">
                {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
              <div className="text-[17px] text-white/60 font-light mt-1">
                {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </motion.div>

            {/* Spacer */}
            <div className="flex-1 min-h-[20px]" />

            {/* Now Playing Widget - iOS Dynamic Island inspired */}
            <motion.div
              className="mx-4 mb-3 rounded-[22px] overflow-hidden"
              style={{ 
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
              initial={{ opacity: 0, y: 50, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.85 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="p-4 pb-3">
                {/* Album art + info row */}
                <div className="flex items-center gap-3 mb-4">
                  {/* Album art */}
                  <motion.div
                    className="relative w-[52px] h-[52px] rounded-[12px] overflow-hidden shadow-lg flex-shrink-0"
                    animate={isPlaying ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={currentSong.id}
                        className="absolute inset-0"
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.35 }}
                      >
                        {currentSong.cover_url ? (
                          <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-white/10 flex items-center justify-center">
                            <Music className="w-6 h-6 text-white/60" />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={currentSong.id}
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -15 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-[15px] font-semibold text-white truncate leading-tight">
                          {currentSong.title}
                        </h3>
                        <p className="text-[13px] text-white/55 truncate leading-tight mt-0.5">
                          {currentSong.artist}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Live indicator */}
                  {isPlaying && (
                    <motion.div
                      className="flex items-end gap-[2px] h-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-[3px] rounded-full bg-white/70"
                          animate={{ height: ['6px', '14px', '6px'] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <Slider
                    value={[progress]}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={([value]) => seek(value)}
                    className="[&_[role=slider]]:w-[14px] [&_[role=slider]]:h-[14px] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-md [&_[data-radix-slider-track]]:h-[3px] [&_[data-radix-slider-track]]:bg-white/15 [&_[data-radix-slider-range]]:bg-white/90"
                  />
                  <div className="flex justify-between mt-1.5 text-[11px] text-white/40 font-medium tabular-nums px-0.5">
                    <span>{formatTime(progress)}</span>
                    <span>-{formatTime(Math.max(0, duration - progress))}</span>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex items-center justify-between px-1">
                  <motion.button
                    onClick={toggleShuffle}
                    className="w-9 h-9 flex items-center justify-center rounded-full"
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <Shuffle className={`w-[16px] h-[16px] ${shuffle ? 'text-white' : 'text-white/35'}`} />
                  </motion.button>

                  <motion.button
                    onClick={prevSong}
                    className="w-11 h-11 flex items-center justify-center"
                    whileTap={{ scale: 0.82 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <SkipBack className="w-[22px] h-[22px] text-white" fill="white" />
                  </motion.button>

                  <motion.button
                    onClick={togglePlay}
                    className="w-[56px] h-[56px] rounded-full bg-white/95 flex items-center justify-center shadow-lg"
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isPlaying ? (
                        <motion.div
                          key="pause"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Pause className="w-[26px] h-[26px] text-black" fill="black" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="play"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Play className="w-[26px] h-[26px] text-black ml-0.5" fill="black" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    onClick={nextSong}
                    className="w-11 h-11 flex items-center justify-center"
                    whileTap={{ scale: 0.82 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <SkipForward className="w-[22px] h-[22px] text-white" fill="white" />
                  </motion.button>

                  <motion.button
                    onClick={toggleRepeat}
                    className="w-9 h-9 flex items-center justify-center rounded-full"
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {repeat === 'one' ? (
                      <Repeat1 className="w-[16px] h-[16px] text-white" />
                    ) : (
                      <Repeat className={`w-[16px] h-[16px] ${repeat !== 'off' ? 'text-white' : 'text-white/35'}`} />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Volume slider */}
            <motion.div
              className="mx-4 mb-4 rounded-[16px] px-4 py-3"
              style={{
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center gap-3">
                <VolumeX className="w-[14px] h-[14px] text-white/35 flex-shrink-0" />
                <Slider
                  value={[volume * 100]}
                  onValueChange={([v]) => setVolume(v / 100)}
                  max={100}
                  step={1}
                  className="flex-1 [&_[role=slider]]:w-[14px] [&_[role=slider]]:h-[14px] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-[3px] [&_[data-radix-slider-track]]:bg-white/15 [&_[data-radix-slider-range]]:bg-white/90"
                />
                <Volume2 className="w-[14px] h-[14px] text-white/35 flex-shrink-0" />
              </div>
            </motion.div>

            {/* Swipe up hint */}
            <motion.div
              className="flex justify-center pb-[env(safe-area-inset-bottom,16px)] pb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                className="w-[36px] h-[5px] bg-white/25 rounded-full"
                animate={{ opacity: [0.25, 0.5, 0.25] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LockScreenPlayer;
