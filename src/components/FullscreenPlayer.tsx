import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Share2, Ellipsis, Mic2, Heart } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import DownloadButton from './DownloadButton';
import LikeButton from './LikeButton';
import SocialShareModal from './SocialShareModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import SongReactions from './SongReactions';
import LyricsDisplay from './LyricsDisplay';
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

// iOS-optimized spring - smooth, responsive, no lag
const iosSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

// Quick tap response spring
const tapSpring = {
  type: "spring" as const,
  stiffness: 600,
  damping: 25,
  mass: 0.3,
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
  const [showLyrics, setShowLyrics] = useState(false);
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

          {/* Main content container - mobile optimized */}
          <div className="relative flex flex-col h-full px-4 pt-2 pb-4">
            {/* Drag indicator */}
            <div className="flex justify-center mb-1">
              <div className="w-9 h-1 rounded-full bg-white/30" />
            </div>

            {/* Header - compact */}
            <div className="flex items-center justify-between mb-2">
              <motion.button 
                className="w-12 h-12 flex items-center justify-center -ml-2 touch-manipulation" 
                onClick={() => { triggerHaptic('impactLight'); setExpanded(false); }} 
                whileTap={{ scale: 0.9 }} 
                transition={tapSpring}
              >
                <ChevronDown className="w-7 h-7 text-white/80" />
              </motion.button>
              
              <div className="text-center flex-1 px-2 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">
                  Playing From
                </p>
                <p className="text-xs font-semibold text-white/90 truncate">
                  {currentSong.album || 'Library'}
                </p>
              </div>
              
              <motion.button 
                className="w-12 h-12 flex items-center justify-center -mr-2 touch-manipulation" 
                onClick={() => { triggerHaptic('impactLight'); setShowPlaylistModal(true); }} 
                whileTap={{ scale: 0.9 }} 
                transition={tapSpring}
              >
                <Ellipsis className="w-6 h-6 text-white/80" />
              </motion.button>
            </div>

            {/* Album Art - flexible, centered */}
            <div className="flex-1 flex items-center justify-center min-h-0 py-2">
              <motion.div 
                className="relative w-[80vw] max-w-[300px] aspect-square" 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: isPlaying ? 1 : 0.95, opacity: 1 }} 
                transition={iosSpring}
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
                      ? `0 0 ${40 + bassFrequency * 30}px ${10 + bassFrequency * 10}px hsl(var(--primary) / ${0.2 + bassFrequency * 0.15}), 0 20px 40px -10px rgba(0, 0, 0, 0.7)` 
                      : '0 15px 30px -10px rgba(0, 0, 0, 0.5)',
                    scale: isPlaying ? 1 + bassFrequency * 0.02 : 1
                  }} 
                  transition={{ duration: 0.05, ease: 'linear' }}
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
                      <div className="text-white/60 text-6xl">♪</div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Controls Section - fixed at bottom */}
            <div className="flex-shrink-0 space-y-3">
              {/* Title and Artist */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">
                    {currentSong.title}
                  </h2>
                  <motion.button 
                    className="text-sm text-rose-400 font-medium truncate block" 
                    onClick={() => {
                      if (currentSong.artist_id) {
                        setExpanded(false);
                        navigate(`/artist/${currentSong.artist_id}`);
                      }
                    }} 
                    whileTap={{ scale: 0.98 }}
                  >
                    {currentSong.artist}
                  </motion.button>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <LikeButton songId={currentSong.id} size="sm" />
                  <DownloadButton song={currentSong} size="sm" />
                </div>
              </div>

              {/* Progress bar - easy to drag, larger touch target */}
              <div className="py-1">
                <Slider 
                  value={[safeProgress]} 
                  max={safeDuration} 
                  step={0.1} 
                  onValueChange={([value]) => seek(value)} 
                  className="[&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/20 [&_[data-radix-slider-range]]:bg-rose-500" 
                />
                <div className="flex justify-between mt-1 text-[11px] font-medium text-white/50">
                  <span>{formatTime(safeProgress)}</span>
                  <span>-{formatTime(Math.max(0, timeRemaining))}</span>
                </div>
              </div>

              {/* Main Controls - centered play button with haptics */}
              <div className="flex items-center justify-center gap-6">
                <motion.button 
                  className={`w-12 h-12 flex items-center justify-center touch-manipulation ${shuffle ? 'text-rose-400' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleShuffle(); }} 
                  whileTap={{ scale: 0.85 }} 
                  transition={tapSpring}
                >
                  <Shuffle className="w-5 h-5" />
                </motion.button>

                <motion.button 
                  className="w-12 h-12 flex items-center justify-center touch-manipulation" 
                  onClick={() => { triggerHaptic('impactMedium'); prevSong(); }} 
                  whileTap={{ scale: 0.85 }} 
                  transition={tapSpring}
                >
                  <SkipBack className="w-8 h-8 text-white" fill="white" />
                </motion.button>
                
                <motion.button 
                  className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center touch-manipulation"
                  onClick={() => { triggerHaptic('impactMedium'); togglePlay(); }} 
                  whileTap={{ scale: 0.9 }} 
                  transition={iosSpring}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-black" fill="black" />
                  ) : (
                    <Play className="w-8 h-8 text-black ml-1" fill="black" />
                  )}
                </motion.button>
                
                <motion.button 
                  className="w-12 h-12 flex items-center justify-center touch-manipulation" 
                  onClick={() => { triggerHaptic('impactMedium'); nextSong(); }} 
                  whileTap={{ scale: 0.85 }} 
                  transition={tapSpring}
                >
                  <SkipForward className="w-8 h-8 text-white" fill="white" />
                </motion.button>

                <motion.button 
                  className={`w-12 h-12 flex items-center justify-center touch-manipulation ${repeat !== 'off' ? 'text-rose-400' : 'text-white/50'}`} 
                  onClick={() => { triggerHaptic('impactLight'); toggleRepeat(); }} 
                  whileTap={{ scale: 0.85 }} 
                  transition={tapSpring}
                >
                  {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </motion.button>
              </div>

              {/* Volume slider */}
              <AppleVolumeSlider value={volume} onChange={setVolume} />

              {/* Bottom actions - compact row with haptics */}
              <div className="flex items-center justify-around pt-1 pb-2">
                <motion.button className="w-12 h-12 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowLyrics(true); }} whileTap={{ scale: 0.85 }} transition={tapSpring}>
                  <Mic2 className="w-5 h-5 text-white/60" />
                </motion.button>

                <motion.button className="w-12 h-12 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowDedicationModal(true); }} whileTap={{ scale: 0.85 }} transition={tapSpring}>
                  <Heart className="w-5 h-5 text-white/60" />
                </motion.button>

                <motion.button className="w-12 h-12 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowShareModal(true); }} whileTap={{ scale: 0.85 }} transition={tapSpring}>
                  <Share2 className="w-5 h-5 text-white/60" />
                </motion.button>
                
                <motion.button className="w-12 h-12 flex items-center justify-center touch-manipulation" onClick={() => { triggerHaptic('selection'); setShowPlaylistModal(true); }} whileTap={{ scale: 0.85 }} transition={tapSpring}>
                  <ListMusic className="w-5 h-5 text-white/60" />
                </motion.button>
              </div>

              {/* Song Reactions - compact */}
              <SongReactions songId={currentSong.id} songTitle={currentSong.title} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modals - lazy mounted */}
      {showShareModal && <SocialShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} song={currentSong} />}
      {showPlaylistModal && <AddToPlaylistModal isOpen={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} song={currentSong} onCreateNew={() => setShowCreatePlaylist(true)} />}
      {showCreatePlaylist && <CreatePlaylistModal isOpen={showCreatePlaylist} onClose={() => setShowCreatePlaylist(false)} onCreated={() => {}} />}
      {showLyrics && <LyricsDisplay isOpen={showLyrics} onClose={() => setShowLyrics(false)} />}
      {showDedicationModal && <SendDedicationModal isOpen={showDedicationModal} onClose={() => setShowDedicationModal(false)} song={currentSong} />}
    </>
  );
});

export default FullscreenPlayer;