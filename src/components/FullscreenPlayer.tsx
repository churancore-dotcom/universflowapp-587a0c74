import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Share2, Ellipsis, Heart } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import DownloadButton from './DownloadButton';
import LikeButton from './LikeButton';
import SocialShareModal from './SocialShareModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import SongReactions from './SongReactions';
import SendDedicationModal from './SendDedicationModal';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import AlbumArtAnimations from './player/AlbumArtAnimations';
import { triggerHaptic } from '@/hooks/useHaptics';

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// iOS + Origin OS 6 optimized springs - ultra smooth, zero lag
const iosSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 32,
  mass: 0.5,
};

// Origin OS 6 elastic bounce for art scaling
const originBounce = {
  type: "spring" as const,
  stiffness: 380,
  damping: 22,
  mass: 0.6,
};

// Ultra-fast tap response
const tapSpring = {
  type: "spring" as const,
  stiffness: 700,
  damping: 28,
  mass: 0.2,
};

// Apple Music volume slider - memoized
const AppleVolumeSlider = memo(function AppleVolumeSlider({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full px-1">
      <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40 flex-shrink-0" />
      <Slider 
        value={[value * 100]} 
        max={100} 
        step={1} 
        onValueChange={([v]) => onChange(v / 100)} 
        className="flex-1 [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 sm:[&_[role=slider]]:w-[18px] sm:[&_[role=slider]]:h-[18px] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-md [&_[data-radix-slider-track]]:h-[3px] sm:[&_[data-radix-slider-track]]:h-[4px] [&_[data-radix-slider-track]]:bg-white/20 [&_[data-radix-slider-range]]:bg-rose-500" 
      />
      <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40 flex-shrink-0" />
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
    audioElement,
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
  const [showDedicationModal, setShowDedicationModal] = useState(false);
  const navigate = useNavigate();

  // Real audio frequency visualization - only compute when expanded
  const { bassFrequency, midFrequency, highFrequency } = useAudioVisualizer(
    isExpanded ? audioElement : null, 
    isPlaying && isExpanded
  );

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      setExpanded(false);
    }
  }, [setExpanded]);

  if (!currentSong || !isExpanded) return null;

  // Safe progress values
  const safeProgress = isFinite(progress) ? progress : 0;
  const safeDuration = isFinite(duration) && duration > 0 ? duration : 100;
  const timeRemaining = safeDuration - safeProgress;

  return (
    <>
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 z-50 bg-black flex flex-col" 
          initial={{ y: "100%" }} 
          animate={{ y: 0 }} 
          exit={{ y: "100%" }} 
          transition={iosSpring} 
          drag="y" 
          dragConstraints={{ top: 0, bottom: 0 }} 
          dragElastic={{ top: 0, bottom: 0.3 }} 
          onDragEnd={handleDragEnd}
        >
          {/* Apple Music blurred background */}
          <div className="absolute inset-0 overflow-hidden">
            {currentSong.cover_url && (
              <img 
                src={currentSong.cover_url} 
                alt="" 
                className="absolute inset-0 w-full h-full object-cover opacity-50 scale-110"
                style={{ filter: 'blur(80px) saturate(1.5)' }} 
              />
            )}
            <div className="absolute inset-0 bg-black/60" />
          </div>

          {/* Main content - compact mobile layout */}
          <div className="relative flex flex-col h-full px-4 pt-2 pb-2 overflow-hidden">
            {/* Drag indicator */}
            <div className="flex justify-center mb-1.5">
              <motion.div 
                className="w-9 h-1 rounded-full bg-white/40"
                whileHover={{ scaleX: 1.2 }}
                transition={tapSpring}
              />
            </div>

            {/* Header - minimal */}
            <div className="flex items-center justify-between mb-2">
              <motion.button 
                className="w-10 h-10 flex items-center justify-center -ml-1 touch-manipulation" 
                onClick={() => { triggerHaptic('impactLight'); setExpanded(false); }} 
                whileTap={{ scale: 0.85 }} 
                transition={tapSpring}
              >
                <ChevronDown className="w-6 h-6 text-white/80" />
              </motion.button>
              
              <motion.div 
                className="text-center flex-1 px-2 min-w-0"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={originBounce}
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Now Playing
                </p>
                <p className="text-xs font-semibold text-white/90 truncate">
                  {currentSong.album || 'Library'}
                </p>
              </motion.div>
              
              <motion.button 
                className="w-10 h-10 flex items-center justify-center -mr-1 touch-manipulation" 
                onClick={() => { triggerHaptic('impactLight'); setShowPlaylistModal(true); }} 
                whileTap={{ scale: 0.85 }} 
                transition={tapSpring}
              >
                <Ellipsis className="w-5 h-5 text-white/80" />
              </motion.button>
            </div>

            {/* Album Art - compact, fixed size for mobile */}
            <div className="flex items-center justify-center py-2">
              <motion.div 
                className="relative w-[72vw] max-w-[280px] aspect-square" 
                initial={{ scale: 0.85, opacity: 0 }} 
                animate={{ 
                  scale: isPlaying ? 1 : 0.96, 
                  opacity: 1 
                }} 
                transition={originBounce}
              >
                <AlbumArtAnimations 
                  isPlaying={isPlaying} 
                  bassFrequency={bassFrequency} 
                  midFrequency={midFrequency} 
                  highFrequency={highFrequency} 
                  songId={currentSong.id} 
                />

                <motion.div 
                  className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl z-10 bg-muted" 
                  animate={{
                    boxShadow: isPlaying 
                      ? `0 0 ${30 + bassFrequency * 25}px ${8 + bassFrequency * 10}px hsl(var(--primary) / ${0.2 + bassFrequency * 0.15})` 
                      : '0 15px 30px -10px rgba(0, 0, 0, 0.5)',
                    scale: isPlaying ? 1 + bassFrequency * 0.01 : 1,
                  }} 
                  transition={{ duration: 0.04, ease: 'linear' }}
                >
                  {currentSong.cover_url ? (
                    <img 
                      src={currentSong.cover_url} 
                      alt={currentSong.title} 
                      className="w-full h-full object-cover" 
                      draggable={false}
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <div className="text-white/60 text-5xl">♪</div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Controls Section - tight spacing */}
            <motion.div 
              className="flex-shrink-0 space-y-2.5 mt-3"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...originBounce, delay: 0.1 }}
            >
              {/* Title and Artist */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <motion.h2 
                    className="text-xl font-bold text-white truncate"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={originBounce}
                  >
                    {currentSong.title}
                  </motion.h2>
                  <motion.button 
                    className="text-base text-rose-400 font-medium truncate block" 
                    onClick={() => {
                      if (currentSong.artist_id) {
                        triggerHaptic('selection');
                        setExpanded(false);
                        navigate(`/artist/${currentSong.artist_id}`);
                      }
                    }} 
                    whileTap={{ scale: 0.97 }}
                    transition={tapSpring}
                  >
                    {currentSong.artist}
                  </motion.button>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <LikeButton songId={currentSong.id} size="sm" />
                  <DownloadButton song={currentSong} size="sm" />
                </div>
              </div>

              {/* Progress bar - large touch target */}
              <div className="py-0.5">
                <Slider 
                  value={[safeProgress]} 
                  max={safeDuration} 
                  step={0.1} 
                  onValueChange={([value]) => seek(value)} 
                  className="[&_[role=slider]]:w-[18px] [&_[role=slider]]:h-[18px] [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-lg [&_[data-radix-slider-track]]:h-[5px] [&_[data-radix-slider-track]]:bg-white/15 [&_[data-radix-slider-range]]:bg-rose-500" 
                />
                <div className="flex justify-between mt-1.5 text-[11px] font-semibold text-white/50 tabular-nums">
                  <span>{formatTime(safeProgress)}</span>
                  <span>-{formatTime(Math.max(0, timeRemaining))}</span>
                </div>
              </div>

              {/* Main Controls - centered with Origin OS bounce */}
              <div className="flex items-center justify-center gap-5">
                <motion.button 
                  className={`w-11 h-11 flex items-center justify-center touch-manipulation rounded-full ${shuffle ? 'text-rose-400 bg-rose-500/15' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleShuffle(); }} 
                  whileTap={{ scale: 0.8 }} 
                  transition={tapSpring}
                >
                  <Shuffle className="w-[18px] h-[18px]" />
                </motion.button>

                <motion.button 
                  className="w-14 h-14 flex items-center justify-center touch-manipulation" 
                  onClick={() => { triggerHaptic('impactMedium'); prevSong(); }} 
                  whileTap={{ scale: 0.8, rotate: -10 }} 
                  transition={tapSpring}
                >
                  <SkipBack className="w-9 h-9 text-white" fill="white" />
                </motion.button>
                
                <motion.button 
                  className="w-[74px] h-[74px] rounded-full bg-white flex items-center justify-center touch-manipulation shadow-xl"
                  onClick={() => { triggerHaptic('impactHeavy'); togglePlay(); }} 
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.03 }}
                  animate={{ 
                    boxShadow: isPlaying 
                      ? '0 0 30px 8px rgba(255,255,255,0.25)' 
                      : '0 8px 25px -5px rgba(0,0,0,0.4)'
                  }}
                  transition={originBounce}
                >
                  <AnimatePresence mode="wait">
                    {isPlaying ? (
                      <motion.div
                        key="pause"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={tapSpring}
                      >
                        <Pause className="w-9 h-9 text-black" fill="black" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="play"
                        initial={{ scale: 0, rotate: 90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -90 }}
                        transition={tapSpring}
                      >
                        <Play className="w-9 h-9 text-black ml-1" fill="black" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
                
                <motion.button 
                  className="w-14 h-14 flex items-center justify-center touch-manipulation" 
                  onClick={() => { triggerHaptic('impactMedium'); nextSong(); }} 
                  whileTap={{ scale: 0.8, rotate: 10 }} 
                  transition={tapSpring}
                >
                  <SkipForward className="w-9 h-9 text-white" fill="white" />
                </motion.button>

                <motion.button 
                  className={`w-11 h-11 flex items-center justify-center touch-manipulation rounded-full ${repeat !== 'off' ? 'text-rose-400 bg-rose-500/15' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleRepeat(); }} 
                  whileTap={{ scale: 0.8 }} 
                  transition={tapSpring}
                >
                  {repeat === 'one' ? <Repeat1 className="w-[18px] h-[18px]" /> : <Repeat className="w-[18px] h-[18px]" />}
                </motion.button>
              </div>

              {/* Volume slider - compact */}
              <div className="pt-1">
                <AppleVolumeSlider value={volume} onChange={setVolume} />
              </div>

              {/* Bottom actions - tight row */}
              <div className="flex items-center justify-around py-1">
                <motion.button className="w-11 h-11 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowDedicationModal(true); }} whileTap={{ scale: 0.8 }} transition={tapSpring}>
                  <Heart className="w-[18px] h-[18px] text-white/60" />
                </motion.button>

                <motion.button className="w-11 h-11 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowShareModal(true); }} whileTap={{ scale: 0.8 }} transition={tapSpring}>
                  <Share2 className="w-[18px] h-[18px] text-white/60" />
                </motion.button>
                
                <motion.button className="w-11 h-11 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowPlaylistModal(true); }} whileTap={{ scale: 0.8 }} transition={tapSpring}>
                  <ListMusic className="w-[18px] h-[18px] text-white/60" />
                </motion.button>
              </div>

              {/* Song Reactions - minimal spacing */}
              <SongReactions songId={currentSong.id} songTitle={currentSong.title} />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modals - lazy mounted */}
      {showShareModal && <SocialShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} song={currentSong} />}
      {showPlaylistModal && <AddToPlaylistModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} song={currentSong} onCreateNew={() => setShowCreatePlaylist(true)} />}
      {showCreatePlaylist && <CreatePlaylistModal isOpen={showCreatePlaylist} onClose={() => setShowCreatePlaylist(false)} onCreated={() => {}} />}
      {showDedicationModal && <SendDedicationModal isOpen={showDedicationModal} onClose={() => setShowDedicationModal(false)} song={currentSong} />}
    </>
  );
});

export default FullscreenPlayer;