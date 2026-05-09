import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    // Hard cap so we never block the app even if video fails to load
    const fallback = setTimeout(onComplete, 3500);
    return () => clearTimeout(fallback);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-black flex items-center justify-center z-50 overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: videoReady ? 1 : 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-44 h-44 rounded-full overflow-hidden flex items-center justify-center"
          style={{ boxShadow: '0 0 60px 10px rgba(255,255,255,0.06)' }}
        >
          <video
            ref={videoRef}
            src="/logo-anim.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedData={() => setVideoReady(true)}
            onEnded={onComplete}
            onError={onComplete}
            className="w-full h-full object-cover"
          />
        </motion.div>

        <motion.h1
          className="mt-8 text-3xl font-semibold tracking-tight text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          Universflow
        </motion.h1>

        <motion.button
          onClick={onComplete}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-10 text-[11px] uppercase tracking-[0.25em] text-white/40 active:scale-95 transition-transform"
        >
          Skip →
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
