import { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Share2, Waves } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Slider } from '@/components/ui/slider';
import { iosSpring, iosBounce } from '@/lib/animations';
import DownloadButton from './DownloadButton';
import LikeButton from './LikeButton';
import ShareSongModal from './ShareSongModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistModal';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const FullscreenPlayer = () => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    isExpanded,
    crossfade,
    togglePlay,
    nextSong,
    prevSong,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    setExpanded,
    toggleCrossfade
  } = usePlayer();

  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      setExpanded(false);
    }
  };

  if (!currentSong || !isExpanded) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1c1c1e 0%, #000000 100%)',
          }}
          initial={{ y: "100%", opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={handleDragEnd}
        >
          {/* Ambient background glow */}
          <div className="absolute inset-0 overflow-hidden">
            {currentSong.cover_url && (
              <motion.img
                src={currentSong.cover_url}
                alt=""
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[60%] object-cover opacity-30 blur-[100px]"
                initial={{ opacity: 0, scale: 1.2 }}
                animate={{ opacity: 0.3, scale: 1 }}
                transition={{ duration: 0.8 }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
          </div>

          <div className="relative flex flex-col h-full px-8 py-6 md:px-16 lg:px-32 safe-area-pt safe-area-pb">
            {/* iOS-style drag indicator */}
            <motion.div 
              className="w-9 h-1 rounded-full bg-white/30 mx-auto mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <motion.button
                className="p-2 -ml-2 rounded-full"
                onClick={() => setExpanded(false)}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                <ChevronDown className="w-7 h-7" />
              </motion.button>
              
              <motion.p 
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Now Playing
              </motion.p>
              
              <motion.button
                className="p-2 -mr-2 rounded-full"
                onClick={() => setShowPlaylistModal(true)}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                <ListMusic className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Album Art - iOS Music style */}
            <div className="flex-1 flex items-center justify-center py-4">
              <motion.div
                className="relative w-72 h-72 md:w-80 md:h-80 lg:w-[360px] lg:h-[360px]"
                layoutId="album-art"
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ ...iosSpring, delay: 0.1 }}
              >
                <motion.div 
                  className="w-full h-full rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  {currentSong.cover_url ? (
                    <img
                      src={currentSong.cover_url}
                      alt={currentSong.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/60 to-accent/60 flex items-center justify-center">
                      <div className="flex items-end gap-1.5 h-28">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`w-3.5 rounded-full bg-gradient-to-t from-white/50 to-white ${
                              isPlaying ? 'animate-equalizer' : ''
                            }`}
                            style={{
                              animationDelay: `${i * 0.12}s`,
                              height: isPlaying ? undefined : '24px',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            </div>

            {/* Song Info */}
            <motion.div 
              className="mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.15 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <motion.h2
                    className="text-2xl md:text-3xl font-bold truncate"
                    layoutId="song-title"
                  >
                    {currentSong.title}
                  </motion.h2>
                  <motion.p
                    className="mt-1 text-xl text-primary font-medium"
                    layoutId="song-artist"
                  >
                    {currentSong.artist}
                  </motion.p>
                </div>
                <div className="flex items-center gap-2">
                  <DownloadButton song={currentSong} size="md" />
                  <motion.button
                    className="p-2 rounded-full"
                    onClick={() => setShowShareModal(true)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    transition={iosBounce}
                  >
                    <Share2 className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
                  </motion.button>
                  <LikeButton songId={currentSong.id} size="md" />
                </div>
              </div>
            </motion.div>

            {/* Progress - iOS style */}
            <motion.div 
              className="mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Slider
                value={[progress]}
                max={duration || 100}
                step={0.1}
                onValueChange={([value]) => seek(value)}
                className="cursor-pointer [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-white"
              />
              <div className="flex justify-between mt-2 text-[11px] font-medium text-muted-foreground tracking-wide">
                <span>{formatTime(progress)}</span>
                <span>-{formatTime(Math.max(0, duration - progress))}</span>
              </div>
            </motion.div>

            {/* Main Controls - iOS style */}
            <motion.div 
              className="flex items-center justify-center gap-10 mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.25 }}
            >
              <motion.button
                className="p-3"
                onClick={prevSong}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                <SkipBack className="w-8 h-8" fill="currentColor" />
              </motion.button>
              
              <motion.button
                className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center text-black"
                onClick={togglePlay}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={iosBounce}
                style={{
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                }}
              >
                {isPlaying ? (
                  <Pause className="w-9 h-9" fill="black" />
                ) : (
                  <Play className="w-9 h-9 ml-1" fill="black" />
                )}
              </motion.button>
              
              <motion.button
                className="p-3"
                onClick={nextSong}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
                transition={iosBounce}
              >
                <SkipForward className="w-8 h-8" fill="currentColor" />
              </motion.button>
            </motion.div>

            {/* Secondary Controls */}
            <motion.div 
              className="flex items-center justify-between mt-8 px-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                className={`p-2 rounded-full transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={toggleShuffle}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={iosBounce}
              >
                <Shuffle className="w-5 h-5" />
              </motion.button>

              {/* Crossfade toggle */}
              <motion.button
                className={`p-2 rounded-full transition-colors ${crossfade ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={toggleCrossfade}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={iosBounce}
                title={crossfade ? 'Crossfade On' : 'Crossfade Off'}
              >
                <Waves className="w-5 h-5" />
              </motion.button>
              
              <div className="flex items-center gap-3 w-28">
                <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setVolume(value / 100)}
                  className="cursor-pointer [&_[role=slider]]:w-3 [&_[role=slider]]:h-3"
                />
              </div>
              
              <motion.button
                className={`p-2 rounded-full transition-colors ${repeat !== 'off' ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={toggleRepeat}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={iosBounce}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      <ShareSongModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        song={currentSong} 
      />
      <AddToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentSong}
        onCreateNew={() => setShowCreatePlaylist(true)}
      />
      <CreatePlaylistModal
        isOpen={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onCreated={() => {}}
      />
    </>
  );
};

export default FullscreenPlayer;
