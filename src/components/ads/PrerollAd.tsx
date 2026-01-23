import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';
import { iosSpring } from '@/lib/animations';

interface PrerollAdProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  adDuration?: number;
}

const PrerollAd = memo(function PrerollAd({ 
  isOpen, 
  onComplete, 
  onSkip,
  adDuration = 5 
}: PrerollAdProps) {
  const { isPremium, isLoading } = usePremium();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(adDuration);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(adDuration);
      setProgress(0);
      return;
    }

    // If premium, skip ad immediately
    if (isPremium && !isLoading) {
      onComplete();
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
      setProgress((prev) => Math.min(prev + (100 / adDuration), 100));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, adDuration, onComplete, isPremium, isLoading]);

  const handleUpgrade = useCallback(() => {
    onSkip?.();
    navigate('/support');
  }, [navigate, onSkip]);

  // Don't show for premium users or while loading
  if (isPremium || isLoading) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-4"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={iosSpring}
          >
            {/* Ad Label & Controls */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-muted-foreground font-medium tracking-wider">
                AD • {countdown}s
              </span>
              <motion.button
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10"
                whileTap={{ scale: 0.9 }}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                )}
              </motion.button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 rounded-full bg-white/10 mb-6 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #8b5cf6, #a855f7)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Ad Card */}
            <motion.div
              className="rounded-3xl p-6 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                backdropFilter: 'blur(20px)',
              }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...iosSpring, delay: 0.1 }}
            >
              {/* Premium Icon */}
              <motion.div
                className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  boxShadow: '0 10px 40px -10px rgba(251, 191, 36, 0.5)',
                }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...iosSpring, delay: 0.2 }}
              >
                <Crown className="w-10 h-10 text-white" />
              </motion.div>

              {/* Message */}
              <motion.h2
                className="text-xl font-bold mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                Skip All Ads Forever
              </motion.h2>
              <motion.p
                className="text-sm text-muted-foreground mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Upgrade to Premium for uninterrupted music, offline downloads, and lossless audio quality.
              </motion.p>

              {/* Benefits */}
              <motion.div
                className="flex flex-wrap justify-center gap-2 mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {['Ad-free', 'Offline', 'Lossless', 'Unlimited'].map((benefit) => (
                  <span
                    key={benefit}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(251, 191, 36, 0.15)',
                      color: '#fbbf24',
                    }}
                  >
                    {benefit}
                  </span>
                ))}
              </motion.div>

              {/* CTA Button */}
              <motion.button
                className="w-full py-3.5 rounded-xl font-semibold text-black"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                }}
                onClick={handleUpgrade}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Try Premium Free
              </motion.button>
            </motion.div>

            {/* Skip hint */}
            <motion.p
              className="text-center text-xs text-muted-foreground mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Ad will close automatically in {countdown} seconds
            </motion.p>

            {/* AdMob Placeholder - uncomment when ready */}
            {/* <div id="admobile-preroll" className="hidden" /> */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default PrerollAd;
