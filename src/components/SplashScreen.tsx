import { useEffect } from 'react';
import { motion } from 'framer-motion';
import appLogo from '@/assets/app-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center z-50 overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Static gradient background — no blur filters */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, hsl(340 100% 50% / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(260 100% 60% / 0.12) 0%, transparent 50%)',
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* Logo container — static glow, no rotating animation */}
        <motion.div
          className="relative"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div
            className="absolute -inset-6 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, hsl(300 80% 55% / 0.3), transparent 70%)',
            }}
          />
          <div
            className="w-36 h-36 rounded-full flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1.5px solid rgba(255,255,255,0.10)',
              boxShadow: '0 0 40px 8px hsl(260 100% 60% / 0.2), 0 0 80px 20px hsl(340 100% 50% / 0.1)',
            }}
          >
            <img
              src={appLogo}
              alt="UniversFlow Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
        </motion.div>

        {/* Simple loading dots instead of waveform bars */}
        <motion.div
          className="flex items-center justify-center gap-2 mt-10 h-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}
        </motion.div>

        {/* Brand name */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold tracking-tight">
            <span
              style={{
                background: 'linear-gradient(135deg, #FF2D55, #BF5AF2, #5E5CE6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Univers
            </span>
            <span className="text-white ml-1.5 font-light">Flow</span>
          </h1>
        </motion.div>

        <motion.p
          className="mt-3 text-[13px] tracking-[0.2em] uppercase font-medium text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Premium Music Experience
        </motion.p>

        {/* Developer credit */}
        <motion.div
          className="mt-8 px-5 py-2 rounded-full flex items-center gap-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-[11px] text-white/40 tracking-wider">
            <span className="text-white/70 font-semibold">UNIVERSFLOW</span>
          </p>
        </motion.div>

        {/* Skip button */}
        <motion.button
          onClick={onComplete}
          className="mt-6 px-6 py-2.5 rounded-full text-white/50 text-xs font-medium tracking-wider uppercase active:scale-95 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Skip →
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SplashScreen;