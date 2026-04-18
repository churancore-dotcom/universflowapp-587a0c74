import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayWithMate } from '@/contexts/PlayWithMateContext';
import { triggerHaptic } from '@/hooks/useHaptics';

const MateHeartButton = memo(function MateHeartButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConnected, participants, reactions } = usePlayWithMate();

  // Hide on the room page itself or on auth/splash
  const hide =
    !isConnected ||
    location.pathname.startsWith('/listen-together') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/admin');

  return (
    <AnimatePresence>
      {!hide && (
        <motion.button
          key="mate-heart"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          onClick={() => {
            triggerHaptic('selection');
            navigate('/listen-together');
          }}
          className="fixed z-[55] right-3 bottom-[150px] flex items-center justify-center w-14 h-14 rounded-full active:scale-95 transition-transform"
          style={{
            background: 'radial-gradient(circle at 30% 30%, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 60%, hsl(var(--primary) / 0.6) 100%)',
            boxShadow: '0 10px 30px -8px hsl(var(--primary) / 0.55), 0 0 0 1px hsl(var(--primary) / 0.4) inset',
          }}
          aria-label="Open Play with Mate room"
        >
          <motion.span
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full"
            style={{ background: 'hsl(var(--primary) / 0.25)', filter: 'blur(8px)' }}
          />
          <Heart className="w-6 h-6 text-primary-foreground relative z-10" fill="currentColor" />

          {participants.length > 1 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-background text-[10px] font-bold text-primary flex items-center justify-center border border-primary/40">
              <Users className="w-2.5 h-2.5 mr-0.5" />
              {participants.length}
            </span>
          )}

          {/* Floating reaction emojis */}
          <AnimatePresence>
            {reactions.slice(-3).map((r) => (
              <motion.span
                key={r.id}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: 1, y: -40, scale: 1.2 }}
                exit={{ opacity: 0, y: -70, scale: 0.6 }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                className="absolute text-xl pointer-events-none"
                style={{ left: `${10 + Math.random() * 30}%`, bottom: '60%' }}
              >
                {r.emoji}
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.button>
      )}
    </AnimatePresence>
  );
});

export default MateHeartButton;
