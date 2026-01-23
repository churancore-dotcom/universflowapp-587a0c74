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
  return Math.abs(hash) % 10; // 10 different animation types
};

// Animation 1: Pulsing Rings
const PulsingRings = memo(({ bass, mid }: { bass: number; mid: number; high: number }) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-2xl border-2 border-primary/30"
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
        background: `radial-gradient(circle, hsl(var(--primary) / ${0.3 + bass * 0.4}) 0%, transparent 70%)`,
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
            className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-primary to-primary/70"
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
        className="absolute inset-[-20%] rounded-full border border-primary/20"
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
        className="absolute inset-0 rounded-2xl border-primary/40"
        style={{
          borderWidth: `${2 - i * 0.3}px`,
          borderStyle: 'solid',
          opacity: 0.5 - i * 0.1,
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
        background: `conic-gradient(from 0deg, transparent, hsl(var(--primary) / ${0.4 + high * 0.3}), transparent, hsl(var(--primary) / ${0.3 + mid * 0.2}), transparent)`,
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
    <motion.div
      className="absolute inset-[-15%]"
      style={{
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        background: `linear-gradient(135deg, hsl(var(--primary) / ${0.2 + bass * 0.3}) 0%, hsl(var(--primary) / ${0.1 + mid * 0.2}) 100%)`,
      }}
      animate={{
        scale: 1.1 + bass * 0.2,
        rotate: bass * 10,
      }}
      transition={{ duration: 0.08 }}
    />
    <motion.div
      className="absolute inset-[5%]"
      style={{
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        background: `linear-gradient(45deg, hsl(var(--primary) / ${0.3 + mid * 0.3}) 0%, transparent 100%)`,
      }}
      animate={{
        scale: 1.05 + mid * 0.15,
        rotate: -mid * 15,
      }}
      transition={{ duration: 0.06 }}
    />
    <motion.div
      className="absolute inset-0 rounded-2xl"
      style={{
        background: `radial-gradient(circle, hsl(var(--primary) / ${0.4 + high * 0.3}) 0%, transparent 60%)`,
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
            className="absolute bg-gradient-to-t from-primary to-primary/70"
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
          boxShadow: `0 0 ${40 + bass * 40}px ${10 + bass * 15}px hsl(var(--primary) / ${0.2 + bass * 0.2})`,
        }}
      />
    </>
  );
});
SpectrumBars.displayName = 'SpectrumBars';

// Animation 6: Neon Glow Pulse
const NeonGlowPulse = memo(({ bass, mid }: { bass: number; mid: number; high: number }) => (
  <>
    <motion.div
      className="absolute inset-[-5%] rounded-3xl"
      style={{
        boxShadow: `
          0 0 ${20 + bass * 40}px ${5 + bass * 10}px hsl(var(--primary) / ${0.4 + bass * 0.3}),
          0 0 ${40 + mid * 60}px ${15 + mid * 20}px hsl(var(--primary) / ${0.2 + mid * 0.2})
        `,
      }}
      animate={{
        scale: 1 + bass * 0.08,
      }}
      transition={{ duration: 0.05 }}
    />
    <motion.div className="absolute inset-0 overflow-hidden rounded-2xl">
      <motion.div
        className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
    {[0, 90, 180, 270].map((rotation) => (
      <motion.div
        key={rotation}
        className="absolute w-8 h-8 border-l-2 border-t-2 border-primary/50"
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

// Animation 7: Vinyl Spin
const VinylSpin = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const grooves = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
  
  return (
    <>
      {/* Vinyl disc */}
      <motion.div
        className="absolute inset-[-15%] rounded-full"
        style={{
          background: `
            radial-gradient(circle at center, 
              transparent 0%, 
              transparent 15%, 
              hsl(var(--primary) / 0.1) 16%, 
              transparent 17%,
              transparent 100%
            ),
            conic-gradient(
              from 0deg,
              hsl(var(--foreground) / 0.15) 0deg,
              hsl(var(--foreground) / 0.05) 90deg,
              hsl(var(--foreground) / 0.15) 180deg,
              hsl(var(--foreground) / 0.05) 270deg,
              hsl(var(--foreground) / 0.15) 360deg
            )
          `,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2 - bass * 0.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Vinyl grooves */}
      {grooves.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-foreground/10"
          style={{
            inset: `${-20 + i * 3}%`,
          }}
          animate={{
            borderColor: i % 2 === 0 
              ? `hsl(var(--primary) / ${0.1 + bass * 0.2})` 
              : `hsl(var(--foreground) / ${0.05 + mid * 0.1})`,
          }}
          transition={{ duration: 0.1 }}
        />
      ))}
      {/* Center label glow */}
      <motion.div
        className="absolute inset-[35%] rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--primary) / ${0.6 + bass * 0.4}) 0%, transparent 70%)`,
        }}
        animate={{ scale: 1 + high * 0.2 }}
        transition={{ duration: 0.05 }}
      />
      {/* Reflection shine */}
      <motion.div
        className="absolute inset-[-15%] rounded-full overflow-hidden"
        style={{ opacity: 0.3 }}
      >
        <motion.div
          className="absolute w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </>
  );
});
VinylSpin.displayName = 'VinylSpin';

// Animation 8: Aurora Borealis
const AuroraBorealis = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const waves = useMemo(() => [
    { color: 'primary', delay: 0, speed: 4 },
    { color: 'primary', delay: 0.5, speed: 5 },
    { color: 'primary', delay: 1, speed: 3.5 },
  ], []);

  return (
    <>
      {/* Aurora waves */}
      {waves.map((wave, i) => (
        <motion.div
          key={i}
          className="absolute inset-[-30%] overflow-hidden"
          style={{ filter: 'blur(20px)' }}
        >
          <motion.div
            className="absolute w-full h-[200%]"
            style={{
              background: `linear-gradient(180deg, 
                transparent 0%,
                hsl(var(--${wave.color}) / ${0.1 + (i === 0 ? bass : i === 1 ? mid : high) * 0.3}) 20%,
                hsl(var(--${wave.color}) / ${0.2 + (i === 0 ? bass : i === 1 ? mid : high) * 0.4}) 40%,
                hsl(var(--${wave.color}) / ${0.15 + mid * 0.2}) 60%,
                transparent 100%
              )`,
              transform: `skewY(${10 + i * 5}deg)`,
            }}
            animate={{
              y: ['-50%', '0%'],
              x: [`${-10 + i * 5}%`, `${10 - i * 5}%`],
            }}
            transition={{
              duration: wave.speed,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
              delay: wave.delay,
            }}
          />
        </motion.div>
      ))}
      {/* Star sparkles */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{
            left: `${10 + (i * 7) % 80}%`,
            top: `${5 + (i * 11) % 90}%`,
          }}
          animate={{
            opacity: [0, 0.8 + high * 0.2, 0],
            scale: [0.5, 1 + bass * 0.5, 0.5],
          }}
          transition={{
            duration: 1.5 + i * 0.2,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
      {/* Outer glow */}
      <motion.div
        className="absolute inset-[-10%] rounded-2xl"
        style={{
          boxShadow: `
            0 0 ${60 + bass * 60}px ${20 + bass * 20}px hsl(var(--primary) / ${0.15 + bass * 0.15}),
            0 0 ${100 + mid * 80}px ${40 + mid * 30}px hsl(var(--primary) / ${0.1 + mid * 0.1})
          `,
        }}
      />
    </>
  );
});
AuroraBorealis.displayName = 'AuroraBorealis';

// Animation 9: 3D Depth Layers
const DepthLayers = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const layers = useMemo(() => [
    { z: 0, scale: 1.3, opacity: 0.15 },
    { z: 1, scale: 1.2, opacity: 0.25 },
    { z: 2, scale: 1.1, opacity: 0.35 },
  ], []);

  return (
    <>
      {/* 3D perspective container */}
      <div 
        className="absolute inset-[-20%]"
        style={{ perspective: '500px', perspectiveOrigin: 'center' }}
      >
        {layers.map((layer, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-2xl border-2 border-primary/30"
            style={{
              transformStyle: 'preserve-3d',
            }}
            animate={{
              rotateX: (i === 0 ? bass : i === 1 ? mid : high) * 15,
              rotateY: (i === 0 ? mid : i === 1 ? high : bass) * 10,
              scale: layer.scale + (i === 0 ? bass : i === 1 ? mid : high) * 0.1,
              opacity: layer.opacity + (i === 0 ? bass : i === 1 ? mid : high) * 0.2,
              translateZ: `${layer.z * 20 + bass * 30}px`,
            }}
            transition={{ duration: 0.08 }}
          />
        ))}
      </div>
      {/* Floating particles */}
      {Array.from({ length: 8 }, (_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-2 h-2 rounded-full bg-primary/40"
          style={{
            left: `${20 + (i * 10) % 60}%`,
            top: `${20 + (i * 13) % 60}%`,
          }}
          animate={{
            y: [0, -20 - bass * 30, 0],
            x: [0, (i % 2 ? 1 : -1) * 10 * mid, 0],
            scale: [1, 1.5 + high * 0.5, 1],
            opacity: [0.3, 0.7 + bass * 0.3, 0.3],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Center depth glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at center, hsl(var(--primary) / ${0.3 + bass * 0.3}) 0%, transparent 60%)`,
        }}
        animate={{
          scale: 1 + bass * 0.1,
        }}
        transition={{ duration: 0.05 }}
      />
    </>
  );
});
DepthLayers.displayName = 'DepthLayers';

// Animation 10: Holographic Prism
const HolographicPrism = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => (
  <>
    {/* Rainbow refraction effect */}
    <motion.div
      className="absolute inset-[-10%] rounded-2xl overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(45deg, 
              hsla(0, 100%, 70%, ${0.15 + bass * 0.2}) 0%,
              hsla(60, 100%, 70%, ${0.15 + mid * 0.2}) 25%,
              hsla(120, 100%, 70%, ${0.15 + high * 0.2}) 50%,
              hsla(180, 100%, 70%, ${0.15 + bass * 0.2}) 75%,
              hsla(240, 100%, 70%, ${0.15 + mid * 0.2}) 100%
            )
          `,
        }}
        animate={{
          rotate: [0, 360],
          scale: [1, 1.1 + bass * 0.1, 1],
        }}
        transition={{
          rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
          scale: { duration: 0.3, repeat: Infinity, repeatType: 'reverse' },
        }}
      />
    </motion.div>
    {/* Prism triangles */}
    {[0, 120, 240].map((rotation, i) => (
      <motion.div
        key={rotation}
        className="absolute inset-[10%]"
        style={{
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          background: `linear-gradient(180deg, 
            hsl(var(--primary) / ${0.1 + (i === 0 ? bass : i === 1 ? mid : high) * 0.3}) 0%, 
            transparent 100%
          )`,
          transform: `rotate(${rotation}deg)`,
        }}
        animate={{
          scale: 1 + (i === 0 ? bass : i === 1 ? mid : high) * 0.15,
          opacity: 0.3 + (i === 0 ? bass : i === 1 ? mid : high) * 0.4,
        }}
        transition={{ duration: 0.08 }}
      />
    ))}
    {/* Light rays */}
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-2xl"
    >
      {[0, 45, 90, 135].map((angle) => (
        <motion.div
          key={angle}
          className="absolute w-[2px] h-full bg-gradient-to-b from-transparent via-white/30 to-transparent"
          style={{
            left: '50%',
            transformOrigin: 'center',
            transform: `rotate(${angle}deg)`,
          }}
          animate={{
            opacity: [0.1, 0.4 + bass * 0.3, 0.1],
            scaleY: [0.8, 1.2 + high * 0.3, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: angle * 0.01,
          }}
        />
      ))}
    </motion.div>
    {/* Outer holographic glow */}
    <motion.div
      className="absolute inset-[-5%] rounded-2xl"
      style={{
        boxShadow: `
          0 0 ${30 + bass * 40}px ${10 + bass * 15}px hsl(var(--primary) / ${0.2 + bass * 0.2}),
          0 0 ${50 + mid * 50}px ${20 + mid * 20}px hsla(280, 100%, 70%, ${0.1 + mid * 0.1}),
          0 0 ${70 + high * 60}px ${30 + high * 25}px hsla(180, 100%, 70%, ${0.1 + high * 0.1})
        `,
      }}
    />
  </>
));
HolographicPrism.displayName = 'HolographicPrism';

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
    case 6:
      return <VinylSpin {...props} />;
    case 7:
      return <AuroraBorealis {...props} />;
    case 8:
      return <DepthLayers {...props} />;
    case 9:
      return <HolographicPrism {...props} />;
    default:
      return <PulsingRings {...props} />;
  }
});

AlbumArtAnimations.displayName = 'AlbumArtAnimations';

export default AlbumArtAnimations;
