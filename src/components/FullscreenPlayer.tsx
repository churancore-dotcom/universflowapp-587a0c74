import { useState, memo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Share2, Sliders } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import LikeButton from './LikeButton';
import DownloadButton from './DownloadButton';
import SocialShareModal from './SocialShareModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import EqualizerModal from './EqualizerModal';
import { supabase } from '@/integrations/supabase/client';
import type { Song } from '@/contexts/PlayerContext';
import { triggerHaptic } from '@/hooks/useHaptics';
import { canDownloadSong, canLikeSong, isIndexedSong } from '@/lib/songSupport';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const songInfoVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.15 } },
};

const albumArtVariants = {
  initial: { opacity: 0, scale: 0.88, rotate: -2 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.92, rotate: 2, transition: { duration: 0.25 } },
};

const VolumeSlider = memo(function VolumeSlider({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 w-full px-1">
      <VolumeX className="w-4 h-4 text-white/40 flex-shrink-0" />
      <Slider 
        value={[value * 100]} 
        max={100} 
        step={1} 
        onValueChange={([v]) => onChange(v / 100)} 
        className="flex-1 [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-[3px] [&_[data-radix-slider-track]]:bg-white/20 [&_[data-radix-slider-range]]:bg-rose-500" 
      />
      <Volume2 className="w-4 h-4 text-white/40 flex-shrink-0" />
    </div>
  );
});

const FullscreenPlayer = memo(function FullscreenPlayer() {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    isExpanded,
    togglePlay,
    nextSong,
    prevSong,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    setExpanded
  } = usePlayer();
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [direction, setDirection] = useState(0);
  const prevSongIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentSong?.id && currentSong.id !== prevSongIdRef.current) {
      prevSongIdRef.current = currentSong.id;
    }
  }, [currentSong?.id]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      setExpanded(false);
    }
  }, [setExpanded]);

  const handleNext = useCallback(() => {
    triggerHaptic('impactMedium');
    setDirection(1);
    nextSong();
  }, [nextSong]);

  const handlePrev = useCallback(() => {
    triggerHaptic('impactMedium');
    setDirection(-1);
    prevSong();
  }, [prevSong]);

  if (!currentSong || !isExpanded) return null;

  const safeProgress = isFinite(progress) ? progress : 0;
  const safeDuration = isFinite(duration) && duration > 0 ? duration : 100;
  const timeRemaining = safeDuration - safeProgress;
  const showLikeAction = canLikeSong(currentSong);
  const showDownloadAction = canDownloadSong(currentSong);
  const isPlaybackOnlyStream = isIndexedSong(currentSong);

  return (
    <>
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 z-50 bg-black flex flex-col" 
          initial={{ y: "100%" }} 
          animate={{ y: 0 }} 
          exit={{ y: "100%" }} 
          transition={{ type: "spring", stiffness: 400, damping: 30 }} 
          drag="y" 
          dragConstraints={{ top: 0, bottom: 0 }} 
          dragElastic={{ top: 0, bottom: 0.3 }} 
          onDragEnd={handleDragEnd}
        >
          {/* Blurred background */}
          <AnimatePresence mode="popLayout">
            <motion.div 
              key={currentSong.id + '-bg'}
              className="absolute inset-0 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {currentSong.cover_url && (
                <img 
                  src={currentSong.cover_url} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                  style={{ filter: 'blur(60px) saturate(1.3)' }} 
                />
              )}
              <div className="absolute inset-0 bg-black/60" />
            </motion.div>
          </AnimatePresence>

          {/* Main content - uses flex to fill space like screenshot */}
          <div className="relative flex flex-col h-full px-5 pt-2 pb-3 overflow-hidden">
            {/* Drag indicator */}
            <div className="flex justify-center mb-1 flex-shrink-0">
              <div className="w-9 h-1 rounded-full bg-white/40" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <button 
                className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform" 
                onClick={() => { triggerHaptic('impactLight'); setExpanded(false); }}
              >
                <ChevronDown className="w-6 h-6 text-white/80" />
              </button>
              
              <div className="text-center flex-1 px-2 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">Now Playing</p>
                <p className="text-xs font-semibold text-white/90 truncate">{currentSong.album || 'Library'}</p>
              </div>
              
              <button 
                className="w-10 h-10 flex items-center justify-center -mr-2 active:scale-90 transition-transform" 
                onClick={() => { triggerHaptic('impactLight'); setShowPlaylistModal(true); }}
              >
                <ListMusic className="w-5 h-5 text-white/80" />
              </button>
            </div>

            {/* Album Art - flex-1 to fill available space */}
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="relative w-[78vw] max-w-[312px] aspect-square">
                {isPlaying && (
                  <motion.div
                    className="absolute inset-[-15%] rounded-3xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 60%)',
                      filter: 'blur(30px)',
                    }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={currentSong.id}
                    className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl z-10 bg-muted"
                    variants={albumArtVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{
                      boxShadow: isPlaying 
                        ? '0 0 40px 10px hsl(var(--primary) / 0.2)' 
                        : '0 15px 30px -10px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    {currentSong.cover_url ? (
                      <img 
                        src={currentSong.cover_url} 
                        alt={currentSong.title} 
                        className="w-full h-full object-cover" 
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                        <div className="text-white/60 text-5xl">♪</div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Controls Section - fixed at bottom */}
            <div className="flex-shrink-0 space-y-2 mt-2">
              {/* Title and Artist */}
              <div className="flex items-start justify-between gap-3 rounded-3xl bg-black/20 px-3 py-2.5 backdrop-blur-md">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div 
                    key={currentSong.id + '-info'}
                    className="flex-1 min-w-0"
                    variants={songInfoVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <h2
                      className="text-lg font-bold text-white leading-tight"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {currentSong.title}
                    </h2>
                    <button 
                      className="text-sm text-rose-400 font-medium block active:opacity-70 mt-1 text-left" 
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      onClick={() => {
                        if (currentSong.artist_id) {
                          triggerHaptic('selection');
                          setExpanded(false);
                          navigate(`/artist/${currentSong.artist_id}`);
                        }
                      }}
                    >
                      {currentSong.artist}
                    </button>
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <LikeButton songId={currentSong.id} song={currentSong} size="sm" />
                  <DownloadButton song={currentSong} size="sm" />
                </div>
              </div>

              {/* Progress bar */}
              <div className="py-0.5">
                <Slider 
                  value={[safeProgress]} 
                  max={safeDuration} 
                  step={0.1} 
                  onValueChange={([value]) => seek(value)} 
                  className="[&_[role=slider]]:w-[18px] [&_[role=slider]]:h-[18px] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-[5px] [&_[data-radix-slider-track]]:bg-white/15 [&_[data-radix-slider-range]]:bg-rose-500" 
                />
                <div className="flex justify-between mt-1.5 text-[11px] font-semibold text-white/50 tabular-nums">
                  <span>{formatTime(safeProgress)}</span>
                  <span>-{formatTime(Math.max(0, timeRemaining))}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-center gap-5">
                <motion.button 
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${shuffle ? 'text-rose-400 bg-rose-500/15' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleShuffle(); }}
                  whileTap={{ scale: 0.85 }}
                >
                  <Shuffle className="w-[18px] h-[18px]" />
                </motion.button>

                <motion.button 
                  className="w-14 h-14 flex items-center justify-center" 
                  onClick={handlePrev}
                  whileTap={{ scale: 0.8, x: -4 }}
                >
                  <SkipBack className="w-9 h-9 text-white" fill="white" />
                </motion.button>
                
                <motion.button 
                  className="w-[74px] h-[74px] rounded-full bg-white flex items-center justify-center shadow-xl"
                  onClick={() => { triggerHaptic('impactHeavy'); togglePlay(); }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={isPlaying ? 'pause' : 'play'}
                      initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.15 }}
                    >
                      {isPlaying ? (
                        <Pause className="w-9 h-9 text-black" fill="black" />
                      ) : (
                        <Play className="w-9 h-9 text-black ml-1" fill="black" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.button>
                
                <motion.button 
                  className="w-14 h-14 flex items-center justify-center" 
                  onClick={handleNext}
                  whileTap={{ scale: 0.8, x: 4 }}
                >
                  <SkipForward className="w-9 h-9 text-white" fill="white" />
                </motion.button>

                <motion.button 
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${repeat !== 'off' ? 'text-rose-400 bg-rose-500/15' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleRepeat(); }}
                  whileTap={{ scale: 0.85 }}
                >
                  {repeat === 'one' ? <Repeat1 className="w-[18px] h-[18px]" /> : <Repeat className="w-[18px] h-[18px]" />}
                </motion.button>
              </div>

              {/* Volume slider */}
              <VolumeSlider value={volume} onChange={setVolume} />

              {/* Bottom actions */}
              <div className="flex items-center justify-around">
                <button 
                  className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform" 
                  onClick={() => { triggerHaptic('selection'); setShowShareModal(true); }}
                >
                  <Share2 className="w-[18px] h-[18px] text-white/60" />
                </button>
                <button 
                  className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform" 
                  onClick={() => { triggerHaptic('selection'); setShowEqualizer(true); }}
                >
                  <Sliders className="w-[18px] h-[18px] text-white/60" />
                </button>
                <button 
                  className="w-11 h-11 flex items-center justify-center active:scale-90 transition-transform" 
                  onClick={() => { triggerHaptic('selection'); setShowPlaylistModal(true); }}
                >
                  <ListMusic className="w-[18px] h-[18px] text-white/60" />
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {showShareModal && <SocialShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} song={currentSong} />}
      {showPlaylistModal && <AddToPlaylistModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} song={currentSong} onCreateNew={() => setShowCreatePlaylist(true)} />}
      {showCreatePlaylist && <CreatePlaylistModal isOpen={showCreatePlaylist} onClose={() => setShowCreatePlaylist(false)} onCreated={() => {}} />}
      {showEqualizer && <EqualizerModal isOpen={showEqualizer} onClose={() => setShowEqualizer(false)} />}
    </>
  );
});

export default FullscreenPlayer;
