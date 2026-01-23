import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface AlbumArtAnimationsProps {
  isPlaying: boolean;
  bassFrequency: number;
  midFrequency: number;
  highFrequency: number;
  songId: string;
}

// Generate a consistent animation type based on song ID
const getAnimationType = (songId: string): number => {
  let hash = 0;
  for (let i = 0; i < songId.length; i++) {
    const char = songId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 6; // 6 different animation types
};

// Animation 1: Pulsing Rings
const PulsingRings = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-2xl border-2 border-rose-500/30"
        animate={{
          scale: 1.1 + (i * 0.15) + bass * 0.3,
          opacity: 0.4 - (i * 0.1) + mid * 0.2,
        }}
        transition={{ duration: 0.08, ease: 'linear' }}
      />
    ))}
    <motion.div
      className="absolute inset-0 rounded-2xl"
      style={{
        background: `radial-gradient(circle, rgba(244, 63, 94, ${0.3 + bass * 0.4}) 0%, transparent 70%)`,
      }}
      animate={{ scale: 1 + bass * 0.15 }}
      transition={{ duration: 0.05 }}
    />
  </>
));
PulsingRings.displayName = 'PulsingRings';

// Animation 2: Rotating Particles
const RotatingParticles = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const particles = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i * 30) * (Math.PI / 180),
  })), []);

  return (
    <>
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-rose-400 to-pink-500"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${p.id * 30}deg) translateY(-${140 + bass * 30}px)`,
            }}
            animate={{
              scale: 0.5 + (p.id % 3 === 0 ? bass : p.id % 3 === 1 ? mid : high) * 1.5,
              opacity: 0.6 + bass * 0.4,
            }}
            transition={{ duration: 0.05 }}
          />
        ))}
      </motion.div>
      <motion.div
        className="absolute inset-[-20%] rounded-full border border-rose-500/20"
        animate={{
          scale: 1.2 + mid * 0.2,
          rotate: -45,
        }}
        transition={{ duration: 0.1 }}
      />
    </>
  );
});
RotatingParticles.displayName = 'RotatingParticles';

// Animation 3: Wave Ripples
const WaveRipples = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-2xl"
        style={{
          border: `${2 - i * 0.3}px solid rgba(244, 63, 94, ${0.5 - i * 0.1})`,
        }}
        animate={{
          scale: 1 + (i * 0.12) + bass * 0.25,
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          scale: { duration: 0.08 },
          opacity: { duration: 0.5, repeat: Infinity, delay: i * 0.1 },
        }}
      />
    ))}
    <motion.div
      className="absolute inset-[-10%] rounded-full opacity-30"
      style={{
        background: `conic-gradient(from 0deg, transparent, rgba(244, 63, 94, ${0.4 + high * 0.3}), transparent, rgba(251, 113, 133, ${0.3 + mid * 0.2}), transparent)`,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    />
  </>
));
WaveRipples.displayName = 'WaveRipples';

// Animation 4: Geometric Pulse
const GeometricPulse = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => (
  <>
    {/* Outer hexagon-like shape */}
    <motion.div
      className="absolute inset-[-15%]"
      style={{
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        background: `linear-gradient(135deg, rgba(244, 63, 94, ${0.2 + bass * 0.3}) 0%, rgba(251, 113, 133, ${0.1 + mid * 0.2}) 100%)`,
      }}
      animate={{
        scale: 1.1 + bass * 0.2,
        rotate: bass * 10,
      }}
      transition={{ duration: 0.08 }}
    />
    {/* Inner diamond */}
    <motion.div
      className="absolute inset-[5%]"
      style={{
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: `linear-gradient(45deg, rgba(251, 113, 133, ${0.3 + mid * 0.3}) 0%, transparent 100%)`,
      }}
      animate={{
        scale: 1.05 + mid * 0.15,
        rotate: -mid * 15,
      }}
      transition={{ duration: 0.06 }}
    />
    {/* Center glow */}
    <motion.div
      className="absolute inset-0 rounded-2xl"
      style={{
        background: `radial-gradient(circle, rgba(244, 63, 94, ${0.4 + high * 0.3}) 0%, transparent 60%)`,
      }}
      animate={{ scale: 1 + high * 0.1 }}
      transition={{ duration: 0.05 }}
    />
  </>
));
GeometricPulse.displayName = 'GeometricPulse';

// Animation 5: Spectrum Bars (circular)
const SpectrumBars = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: i * 15,
  })), []);

  return (
    <>
      {bars.map((bar) => {
        const freq = bar.id % 3 === 0 ? bass : bar.id % 3 === 1 ? mid : high;
        return (
          <motion.div
            key={bar.id}
            className="absolute bg-gradient-to-t from-rose-500 to-pink-400"
            style={{
              width: '3px',
              height: '20px',
              left: '50%',
              top: '50%',
              transformOrigin: 'center bottom',
              transform: `translate(-50%, -100%) rotate(${bar.angle}deg) translateY(-130px)`,
              borderRadius: '2px',
            }}
            animate={{
              scaleY: 1 + freq * 3,
              opacity: 0.5 + freq * 0.5,
            }}
            transition={{ duration: 0.05 }}
          />
        );
      })}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          boxShadow: `0 0 ${40 + bass * 40}px ${10 + bass * 15}px rgba(244, 63, 94, ${0.2 + bass * 0.2})`,
        }}
      />
    </>
  );
});
SpectrumBars.displayName = 'SpectrumBars';

// Animation 6: Neon Glow Pulse
const NeonGlowPulse = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => (
  <>
    {/* Multi-layer neon glow */}
    <motion.div
      className="absolute inset-[-5%] rounded-3xl"
      style={{
        boxShadow: `
          0 0 ${20 + bass * 40}px ${5 + bass * 10}px rgba(244, 63, 94, ${0.4 + bass * 0.3}),
          0 0 ${40 + mid * 60}px ${15 + mid * 20}px rgba(251, 113, 133, ${0.2 + mid * 0.2}),
          0 0 ${60 + high * 80}px ${25 + high * 30}px rgba(253, 164, 175, ${0.1 + high * 0.15})
        `,
      }}
      animate={{
        scale: 1 + bass * 0.08,
      }}
      transition={{ duration: 0.05 }}
    />
    {/* Scanning line effect */}
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-2xl"
    >
      <motion.div
        className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-rose-400/60 to-transparent"
        animate={{
          top: ['0%', '100%'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
    {/* Corner accents */}
    {[0, 90, 180, 270].map((rotation) => (
      <motion.div
        key={rotation}
        className="absolute w-8 h-8 border-l-2 border-t-2 border-rose-400/50"
        style={{
          top: rotation < 180 ? '-10px' : 'auto',
          bottom: rotation >= 180 ? '-10px' : 'auto',
          left: rotation === 0 || rotation === 180 ? '-10px' : 'auto',
          right: rotation === 90 || rotation === 270 ? '-10px' : 'auto',
          transform: `rotate(${rotation}deg)`,
        }}
        animate={{
          opacity: 0.5 + (rotation % 180 === 0 ? bass : mid) * 0.5,
          scale: 1 + (rotation % 180 === 0 ? bass : mid) * 0.2,
        }}
        transition={{ duration: 0.08 }}
      />
    ))}
  </>
));
NeonGlowPulse.displayName = 'NeonGlowPulse';

const AlbumArtAnimations = memo(({ isPlaying, bassFrequency, midFrequency, highFrequency, songId }: AlbumArtAnimationsProps) => {
  const animationType = useMemo(() => getAnimationType(songId), [songId]);

  if (!isPlaying) return null;

  const props = { bass: bassFrequency, mid: midFrequency, high: highFrequency };

  switch (animationType) {
    case 0:
      return <PulsingRings {...props} />;
    case 1:
      return <RotatingParticles {...props} />;
    case 2:
      return <WaveRipples {...props} />;
    case 3:
      return <GeometricPulse {...props} />;
    case 4:
      return <SpectrumBars {...props} />;
    case 5:
      return <NeonGlowPulse {...props} />;
    default:
      return <PulsingRings {...props} />;
  }
});

AlbumArtAnimations.displayName = 'AlbumArtAnimations';

export default AlbumArtAnimations;
