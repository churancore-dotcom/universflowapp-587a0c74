import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, X, Check, Clock } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { toast } from 'sonner';
import { iosSpring } from '@/lib/animations';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const timerOptions = [
  { label: '5 minutes', minutes: 5 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

const SleepTimerModal = memo(({ isOpen, onClose }: SleepTimerModalProps) => {
  const { pause } = usePlayer();
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    if (activeTimer === null || remainingTime <= 0) return;

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          pause();
          setActiveTimer(null);
          toast.success('Sleep timer ended. Sweet dreams! 🌙');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, remainingTime, pause]);

  const handleSetTimer = useCallback((minutes: number) => {
    setActiveTimer(minutes);
    setRemainingTime(minutes * 60);
    toast.success(`Sleep timer set for ${minutes} minutes 🌙`);
    onClose();
  }, [onClose]);

  const handleCancelTimer = useCallback(() => {
    setActiveTimer(null);
    setRemainingTime(0);
    toast.info('Sleep timer cancelled');
    onClose();
  }, [onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl p-6 pb-10 safe-area-pb"
          style={{
            background: 'linear-gradient(180deg, rgba(38, 38, 40, 0.98), rgba(28, 28, 30, 0.98))',
            backdropFilter: 'blur(40px)',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={iosSpring}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="w-9 h-1 rounded-full bg-white/30 mx-auto mb-6" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Moon className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Sleep Timer</h2>
            </div>
            <motion.button
              className="p-2 rounded-full bg-white/10"
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Active Timer Display */}
          {activeTimer !== null && (
            <motion.div
              className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Time remaining</p>
                    <p className="text-2xl font-bold text-primary">{formatTime(remainingTime)}</p>
                  </div>
                </div>
                <motion.button
                  className="px-4 py-2 rounded-full bg-destructive/20 text-destructive text-sm font-semibold"
                  onClick={handleCancelTimer}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Timer Options */}
          <div className="grid grid-cols-2 gap-3">
            {timerOptions.map((option, index) => (
              <motion.button
                key={option.minutes}
                className={`p-4 rounded-2xl text-left transition-colors ${
                  activeTimer === option.minutes
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
                onClick={() => handleSetTimer(option.minutes)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{option.label}</span>
                  {activeTimer === option.minutes && (
                    <Check className="w-5 h-5" />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

SleepTimerModal.displayName = 'SleepTimerModal';

export default SleepTimerModal;
