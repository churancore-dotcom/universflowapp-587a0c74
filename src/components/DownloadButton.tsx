import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, Trash2, Loader2, CloudOff, AlertCircle, ListPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDownloads } from '@/contexts/DownloadContext';
import { Song } from '@/contexts/PlayerContext';
import { iosBounce } from '@/lib/animations';
import { triggerHaptic } from '@/hooks/useHaptics';
import { usePremium } from '@/hooks/usePremium';
import { toast } from '@/hooks/use-toast';

interface DownloadButtonProps {
  song: Song;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  queueMode?: boolean;
}

const DownloadButton = ({ song, size = 'md', showLabel = false, queueMode = false }: DownloadButtonProps) => {
  const { downloadSong, addToQueue, removeSong, isDownloaded, isInQueue, downloadProgress } = useDownloads();
  const { isPremium } = usePremium();
  const navigate = useNavigate();

  const downloaded = isDownloaded(song.id);
  const inQueue = isInQueue(song.id);
  const progress = downloadProgress[song.id];
  const isDownloading = progress?.status === 'downloading' || progress?.status === 'pending';
  const hasError = progress?.status === 'error';

  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const iconSizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || inQueue) return;

    triggerHaptic('impactMedium');

    if (!isPremium && !downloaded) {
      toast({ title: 'Premium feature', description: 'Unlimited downloads are part of Premium.' });
      navigate('/premium');
      return;
    }

    if (downloaded) removeSong(song.id);
    else if (queueMode) addToQueue([song]);
    else downloadSong(song);
  };

  return (
    <motion.button
      className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center transition-colors group ${inQueue ? 'opacity-60' : ''}`}
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
      transition={iosBounce}
      disabled={inQueue}
    >
      {/* Progress ring */}
      <AnimatePresence>
        {isDownloading && (
          <motion.svg
            className="absolute inset-0 -rotate-90"
            viewBox="0 0 40 40"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {/* Background circle */}
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            {/* Progress circle */}
            <motion.circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="url(#downloadGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 17}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
              animate={{ 
                strokeDashoffset: 2 * Math.PI * 17 * (1 - (progress?.progress || 0) / 100) 
              }}
              transition={{ duration: 0.3 }}
            />
            <defs>
              <linearGradient id="downloadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="50%" stopColor="hsl(270, 100%, 65%)" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </motion.svg>
        )}
      </AnimatePresence>

      {/* Background glow for downloaded state */}
      <AnimatePresence>
        {downloaded && !isDownloading && (
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={iosBounce}
          />
        )}
      </AnimatePresence>

      {/* Inner content */}
      <motion.div
        className={`relative z-10 ${downloaded ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
      >
        <AnimatePresence mode="wait">
          {isDownloading ? (
            <motion.div
              key="loading"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className={iconSizes[size]} />
              </motion.div>
            </motion.div>
          ) : hasError ? (
            <motion.div
              key="error"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-destructive"
            >
              <AlertCircle className={iconSizes[size]} />
            </motion.div>
          ) : inQueue ? (
            <motion.div
              key="queued"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-primary"
            >
              <ListPlus className={iconSizes[size]} />
            </motion.div>
          ) : downloaded ? (
            <motion.div
              key="downloaded"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative group-hover:hidden"
            >
              <CloudOff className={iconSizes[size]} />
            </motion.div>
          ) : (
            <motion.div
              key="download"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <Download className={iconSizes[size]} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show delete icon on hover when downloaded */}
        {downloaded && !isDownloading && (
          <motion.div
            className="hidden group-hover:flex absolute inset-0 items-center justify-center text-destructive"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Trash2 className={iconSizes[size]} />
          </motion.div>
        )}
      </motion.div>

      {/* Success animation burst */}
      <AnimatePresence>
        {progress?.status === 'completed' && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  x: Math.cos((i * Math.PI * 2) / 8) * 30,
                  y: Math.sin((i * Math.PI * 2) / 8) * 30,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 0.6,
                  ease: "easeOut",
                }}
              />
            ))}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          </>
        )}
      </AnimatePresence>

      {showLabel && (
        <span className="ml-2 text-sm">
          {isDownloading 
            ? `${progress?.progress || 0}%` 
            : inQueue
            ? 'Queued'
            : downloaded 
            ? 'Downloaded' 
            : 'Download'}
        </span>
      )}
    </motion.button>
  );
};

export default DownloadButton;
