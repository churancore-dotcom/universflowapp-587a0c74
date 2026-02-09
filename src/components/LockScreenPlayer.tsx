import { motion, AnimatePresence, Transition } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { iosSpring, iosBounce } from '@/lib/animations';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Music,
  X,
  Volume2,
  Shuffle,
  Repeat,
  Repeat1
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

const lockScreenSpring: Transition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const LockScreenPlayer = ({ isOpen, onClose }: LockScreenPlayerProps) => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    seek,
  } = usePlayer();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Lock screen background with album art blur */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Album art as background */}
            {currentSong.cover_url && (
              <motion.img
                src={currentSong.cover_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={iosSpring}
              />
            )}
            
            {/* Heavy blur overlay */}
            <div className="absolute inset-0 backdrop-blur-[100px] bg-black/60" />
            
            {/* Gradient overlays for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </motion.div>

          {/* Lock screen UI */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-auto px-6"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={lockScreenSpring}
          >
            {/* Close button */}
            <motion.button
              onClick={onClose}
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full glass flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={iosBounce}
            >
              <X className="w-5 h-5 text-white/80" />
            </motion.button>

            {/* Time display (lock screen style) */}
            <motion.div
              className="text-center mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.1 }}
            >
              <div className="text-6xl font-extralight text-white tracking-tight">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
              <div className="text-base text-white/60 font-light mt-1">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </motion.div>

            {/* Now Playing Widget */}
            <motion.div
              className="glass-ultra rounded-3xl p-5 backdrop-blur-xl"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...iosSpring, delay: 0.2 }}
            >
              {/* Album art and info */}
              <div className="flex items-center gap-4 mb-4">
                {/* Album art with glow */}
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 rounded-xl blur-xl opacity-60"
                    style={{
                      backgroundImage: currentSong.cover_url 
                        ? `url(${currentSong.cover_url})`
                        : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                      backgroundSize: 'cover',
                    }}
                    animate={{
                      scale: isPlaying ? [1, 1.1, 1] : 1,
                    }}
                    transition={{
                      duration: 2,
                      repeat: isPlaying ? Infinity : 0,
                      ease: 'easeInOut',
                    }}
                  />
                  <motion.div
                    className="relative w-16 h-16 rounded-xl overflow-hidden shadow-2xl"
                    animate={isPlaying ? { rotate: [0, 1, -1, 0] } : {}}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {currentSong.cover_url ? (
                      <img
                        src={currentSong.cover_url}
                        alt={currentSong.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Music className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Song info */}
                <div className="flex-1 min-w-0">
                  <motion.h3
                    className="text-white font-semibold text-base truncate"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...iosSpring, delay: 0.3 }}
                  >
                    {currentSong.title}
                  </motion.h3>
                  <motion.p
                    className="text-white/60 text-sm truncate"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...iosSpring, delay: 0.35 }}
                  >
                    {currentSong.artist}
                  </motion.p>
                </div>
              </div>

              {/* Progress bar - interactive */}
              <div className="mb-4">
                <Slider
                  value={[progress]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={([value]) => seek(value)}
                  className="[&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/20 [&_[data-radix-slider-range]]:bg-white"
                />
                <div className="flex justify-between mt-2 text-xs text-white/50 font-medium">
                  <span>{formatTime(progress)}</span>
                  <span>-{formatTime(Math.max(0, duration - progress))}</span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-6">
                <motion.button
                  onClick={toggleShuffle}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    shuffle ? 'bg-white/20 text-white' : 'text-white/50'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={iosBounce}
                >
                  <Shuffle className="w-4 h-4" />
                </motion.button>

                <motion.button
                  onClick={prevSong}
                  className="text-white/80 hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={iosBounce}
                >
                  <SkipBack className="w-7 h-7" fill="currentColor" />
                </motion.button>

                <motion.button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  transition={iosBounce}
                >
                  <AnimatePresence mode="wait">
                    {isPlaying ? (
                      <motion.div
                        key="pause"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={iosBounce}
                      >
                        <Pause className="w-8 h-8 text-black" fill="black" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="play"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={iosBounce}
                      >
                        <Play className="w-8 h-8 text-black ml-1" fill="black" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  onClick={nextSong}
                  className="text-white/80 hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={iosBounce}
                >
                  <SkipForward className="w-7 h-7" fill="currentColor" />
                </motion.button>

                <motion.button
                  onClick={toggleRepeat}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    repeat !== 'off' ? 'bg-white/20 text-white' : 'text-white/50'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  transition={iosBounce}
                >
                  {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </motion.button>
              </div>
            </motion.div>

            {/* Volume slider */}
            <motion.div
              className="mt-4 glass-ultra rounded-2xl p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-white/50" />
                <Slider
                  value={[volume * 100]}
                  onValueChange={([v]) => setVolume(v / 100)}
                  max={100}
                  step={1}
                  className="flex-1 [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0"
                />
              </div>
            </motion.div>

            {/* Swipe hint */}
            <motion.div
              className="mt-6 flex justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <motion.div
                className="w-32 h-1 bg-white/30 rounded-full"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LockScreenPlayer;