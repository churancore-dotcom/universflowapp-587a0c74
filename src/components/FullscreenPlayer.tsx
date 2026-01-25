import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Share2, Ellipsis, Mic2, Heart } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNavigate } from 'react-router-dom';
import { Slider } from '@/components/ui/slider';
import { iosBounce } from '@/lib/animations';
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

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Apple Music spring config
const appleSpring = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
  mass: 1
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
          transition={appleSpring} 
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

          {/* Main content container */}
          <div className="relative flex flex-col h-full px-6 pt-3 pb-6">
            {/* Drag indicator */}
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <motion.button 
                className="p-2 -ml-2 touch-manipulation" 
                onClick={() => setExpanded(false)} 
                whileTap={{ scale: 0.9 }} 
                transition={iosBounce}
              >
                <ChevronDown className="w-7 h-7 text-white/80" />
              </motion.button>
              
              <div className="text-center flex-1 px-4 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">
                  Playing From
                </p>
                <p className="text-xs font-semibold text-white/90 truncate">
                  {currentSong.album || 'Library'}
                </p>
              </div>
              
              <motion.button 
                className="p-2 -mr-2 touch-manipulation" 
                onClick={() => setShowPlaylistModal(true)} 
                whileTap={{ scale: 0.9 }} 
                transition={iosBounce}
              >
                <Ellipsis className="w-6 h-6 text-white/80" />
              </motion.button>
            </div>

            {/* Album Art - centered and sized properly */}
            <div className="flex-1 flex items-center justify-center min-h-0 mb-4">
              <motion.div 
                className="relative w-[75vw] max-w-[320px] aspect-square" 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: isPlaying ? 1 : 0.95, opacity: 1 }} 
                transition={appleSpring}
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

            {/* Song Info & Controls */}
            <div className="flex-shrink-0 space-y-4">
              {/* Title and Artist */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">
                    {currentSong.title}
                  </h2>
                  <motion.button 
                    className="text-base text-rose-400 font-medium truncate block" 
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <LikeButton songId={currentSong.id} size="sm" />
                  <DownloadButton song={currentSong} size="sm" />
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <Slider 
                  value={[safeProgress]} 
                  max={safeDuration} 
                  step={0.1} 
                  onValueChange={([value]) => seek(value)} 
                  className="[&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[data-radix-slider-track]]:h-[3px] [&_[data-radix-slider-track]]:bg-white/20 [&_[data-radix-slider-range]]:bg-rose-500" 
                />
                <div className="flex justify-between mt-1.5 text-xs font-medium text-white/50">
                  <span>{formatTime(safeProgress)}</span>
                  <span>-{formatTime(Math.max(0, timeRemaining))}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between px-2">
                <motion.button 
                  className={`p-2 touch-manipulation ${shuffle ? 'text-rose-400' : 'text-white/50'}`} 
                  onClick={toggleShuffle} 
                  whileTap={{ scale: 0.85 }} 
                  transition={iosBounce}
                >
                  <Shuffle className="w-5 h-5" />
                </motion.button>

                <motion.button 
                  className="p-2 touch-manipulation" 
                  onClick={prevSong} 
                  whileTap={{ scale: 0.85 }} 
                  transition={iosBounce}
                >
                  <SkipBack className="w-8 h-8 text-white" fill="white" />
                </motion.button>
                
                <motion.button 
                  className="w-18 h-18 rounded-full bg-white flex items-center justify-center touch-manipulation" 
                  style={{ width: 72, height: 72 }}
                  onClick={togglePlay} 
                  whileTap={{ scale: 0.9 }} 
                  transition={appleSpring}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-black" fill="black" />
                  ) : (
                    <Play className="w-8 h-8 text-black ml-1" fill="black" />
                  )}
                </motion.button>
                
                <motion.button 
                  className="p-2 touch-manipulation" 
                  onClick={nextSong} 
                  whileTap={{ scale: 0.85 }} 
                  transition={iosBounce}
                >
                  <SkipForward className="w-8 h-8 text-white" fill="white" />
                </motion.button>

                <motion.button 
                  className={`p-2 touch-manipulation ${repeat !== 'off' ? 'text-rose-400' : 'text-white/50'}`} 
                  onClick={toggleRepeat} 
                  whileTap={{ scale: 0.85 }} 
                  transition={iosBounce}
                >
                  {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </motion.button>
              </div>

              {/* Volume slider */}
              <div className="px-2">
                <AppleVolumeSlider value={volume} onChange={setVolume} />
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-around pb-2">
                <motion.button className="p-3 touch-manipulation" onClick={() => setShowLyrics(true)} whileTap={{ scale: 0.85 }}>
                  <Mic2 className="w-5 h-5 text-white/60" />
                </motion.button>

                <motion.button className="p-3 touch-manipulation" onClick={() => setShowDedicationModal(true)} whileTap={{ scale: 0.85 }}>
                  <Heart className="w-5 h-5 text-white/60" />
                </motion.button>

                <motion.button className="p-3 touch-manipulation" onClick={() => setShowShareModal(true)} whileTap={{ scale: 0.85 }}>
                  <Share2 className="w-5 h-5 text-white/60" />
                </motion.button>
                
                <motion.button className="p-3 touch-manipulation" onClick={() => setShowPlaylistModal(true)} whileTap={{ scale: 0.85 }}>
                  <ListMusic className="w-5 h-5 text-white/60" />
                </motion.button>
              </div>

              {/* Song Reactions */}
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