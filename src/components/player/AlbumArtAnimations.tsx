import { memo, useMemo, useRef, useEffect, useState } from 'react';
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
  return Math.abs(hash) % 8; // 8 different animation types
};

// Animation 1: Electric Pulse Storm
const ElectricPulseStorm = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const bolts = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    angle: (i * 22.5),
    delay: i * 0.05,
  })), []);

  return (
    <>
      {/* Electric core */}
      <motion.div
        className="absolute inset-[20%] rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsl(var(--primary) / ${0.8 + bass * 0.2}) 0%, 
            hsl(var(--primary) / ${0.4 + mid * 0.3}) 40%, 
            transparent 70%)`,
          filter: `blur(${8 + bass * 15}px)`,
        }}
        animate={{
          scale: [1, 1.3 + bass * 0.5, 1],
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
      
      {/* Lightning bolts */}
      {bolts.map((bolt) => (
        <motion.div
          key={bolt.id}
          className="absolute left-1/2 top-1/2 origin-bottom"
          style={{
            width: '3px',
            height: `${80 + bass * 60}px`,
            background: `linear-gradient(to top, 
              hsl(var(--primary) / ${0.9 + high * 0.1}), 
              hsl(var(--primary) / 0.3), 
              transparent)`,
            transform: `translate(-50%, -100%) rotate(${bolt.angle}deg)`,
            filter: 'blur(1px)',
            boxShadow: `0 0 ${10 + bass * 20}px hsl(var(--primary) / 0.8)`,
          }}
          animate={{
            scaleY: [0.3, 1 + bass * 0.8, 0.3],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.12,
            repeat: Infinity,
            delay: bolt.delay,
          }}
        />
      ))}

      {/* Outer shockwave rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute inset-[-20%] rounded-full border-2"
          style={{
            borderColor: `hsl(var(--primary) / ${0.5 - i * 0.15})`,
            boxShadow: `0 0 ${20 + bass * 30}px hsl(var(--primary) / ${0.3 - i * 0.1})`,
          }}
          animate={{
            scale: [1 + i * 0.1, 1.4 + bass * 0.6 + i * 0.15, 1 + i * 0.1],
            opacity: [0.6, 0.2, 0.6],
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            delay: i * 0.06,
          }}
        />
      ))}
    </>
  );
});
ElectricPulseStorm.displayName = 'ElectricPulseStorm';

// Animation 2: Liquid Morphing Blob
const LiquidMorphingBlob = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const [morphPhase, setMorphPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMorphPhase(p => (p + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const blobPath = useMemo(() => {
    const points = 12;
    const baseRadius = 120;
    const variance = 30 + bass * 50;
    
    let path = '';
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const offset = Math.sin(angle * 3 + morphPhase * 0.1) * variance * (1 + mid);
      const r = baseRadius + offset;
      const x = 160 + Math.cos(angle) * r;
      const y = 160 + Math.sin(angle) * r;
      path += i === 0 ? `M ${x} ${y}` : ` Q ${x + 10} ${y + 10} ${x} ${y}`;
    }
    return path + ' Z';
  }, [morphPhase, bass, mid]);

  return (
    <>
      <svg className="absolute inset-[-25%] w-[150%] h-[150%]" viewBox="0 0 320 320">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -12" result="goo" />
          </filter>
          <linearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={`hsl(var(--primary))`} stopOpacity={0.8 + bass * 0.2} />
            <stop offset="50%" stopColor={`hsl(var(--primary))`} stopOpacity={0.5 + mid * 0.3} />
            <stop offset="100%" stopColor={`hsl(var(--primary))`} stopOpacity={0.3 + high * 0.2} />
          </linearGradient>
        </defs>
        <motion.path
          d={blobPath}
          fill="url(#blobGradient)"
          filter="url(#goo)"
          animate={{
            scale: 1 + bass * 0.15,
          }}
          style={{ transformOrigin: 'center' }}
        />
      </svg>
      
      {/* Inner glow pulse */}
      <motion.div
        className="absolute inset-[10%] rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--primary) / ${0.6 + bass * 0.4}) 0%, transparent 70%)`,
          filter: `blur(${15 + bass * 20}px)`,
        }}
        animate={{
          scale: [1, 1.2 + bass * 0.3, 1],
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
    </>
  );
});
LiquidMorphingBlob.displayName = 'LiquidMorphingBlob';

// Animation 3: Particle Explosion
const ParticleExplosion = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const particles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    angle: Math.random() * 360,
    distance: 80 + Math.random() * 100,
    size: 3 + Math.random() * 6,
    speed: 0.8 + Math.random() * 0.4,
  })), []);

  return (
    <>
      {/* Central burst */}
      <motion.div
        className="absolute inset-[25%] rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsl(var(--primary)) 0%, 
            hsl(var(--primary) / 0.5) 50%, 
            transparent 70%)`,
          filter: `blur(${5 + bass * 15}px)`,
        }}
        animate={{
          scale: [0.8, 1.5 + bass * 0.8, 0.8],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{ duration: 0.12, repeat: Infinity }}
      />

      {/* Exploding particles */}
      {particles.map((p) => {
        const freq = p.id % 3 === 0 ? bass : p.id % 3 === 1 ? mid : high;
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size + freq * 8,
              height: p.size + freq * 8,
              left: '50%',
              top: '50%',
              background: `radial-gradient(circle, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.3) 100%)`,
              boxShadow: `0 0 ${8 + freq * 15}px hsl(var(--primary) / 0.8)`,
            }}
            animate={{
              x: Math.cos(p.angle * Math.PI / 180) * (p.distance + freq * 80) - p.size / 2,
              y: Math.sin(p.angle * Math.PI / 180) * (p.distance + freq * 80) - p.size / 2,
              opacity: [0.3, 1, 0.3],
              scale: [0.5, 1 + freq * 0.5, 0.5],
            }}
            transition={{
              duration: 0.15 * p.speed,
              repeat: Infinity,
            }}
          />
        );
      })}

      {/* Shockwave */}
      <motion.div
        className="absolute inset-[-10%] rounded-full border-4"
        style={{
          borderColor: `hsl(var(--primary) / ${0.6 + bass * 0.4})`,
          boxShadow: `0 0 ${30 + bass * 50}px hsl(var(--primary) / 0.5)`,
        }}
        animate={{
          scale: [0.6, 1.3 + bass * 0.4, 0.6],
          opacity: [0.8, 0.2, 0.8],
        }}
        transition={{ duration: 0.2, repeat: Infinity }}
      />
    </>
  );
});
ParticleExplosion.displayName = 'ParticleExplosion';

// Animation 4: Nebula Swirl
const NebulaSwirl = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const clouds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    id: i,
    rotation: i * 60,
    scale: 0.8 + i * 0.1,
  })), []);

  return (
    <>
      {/* Rotating nebula layers */}
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute inset-[-30%]"
          style={{
            background: `conic-gradient(from ${cloud.rotation}deg at 50% 50%, 
              transparent 0deg, 
              hsl(var(--primary) / ${0.2 + bass * 0.3}) 60deg, 
              hsl(var(--primary) / ${0.3 + mid * 0.2}) 120deg, 
              transparent 180deg,
              hsl(var(--primary) / ${0.15 + high * 0.2}) 240deg,
              transparent 360deg)`,
            filter: `blur(${20 + cloud.id * 5}px)`,
          }}
          animate={{
            rotate: [cloud.rotation, cloud.rotation + 360],
            scale: [cloud.scale, cloud.scale + bass * 0.3, cloud.scale],
          }}
          transition={{
            rotate: { duration: 8 - cloud.id * 0.5, repeat: Infinity, ease: 'linear' },
            scale: { duration: 0.15, repeat: Infinity },
          }}
        />
      ))}

      {/* Star field */}
      {Array.from({ length: 20 }, (_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            left: `${10 + (i * 4.5) % 80}%`,
            top: `${5 + (i * 7.3) % 90}%`,
            boxShadow: '0 0 6px white',
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1.5 + high * 1, 0.5],
          }}
          transition={{
            duration: 0.3 + i * 0.05,
            repeat: Infinity,
            delay: i * 0.08,
          }}
        />
      ))}

      {/* Core glow */}
      <motion.div
        className="absolute inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsl(var(--primary) / ${0.7 + bass * 0.3}) 0%, 
            hsl(var(--primary) / 0.2) 50%, 
            transparent 70%)`,
          filter: `blur(${10 + bass * 20}px)`,
        }}
        animate={{
          scale: [1, 1.4 + bass * 0.5, 1],
        }}
        transition={{ duration: 0.12, repeat: Infinity }}
      />
    </>
  );
});
NebulaSwirl.displayName = 'NebulaSwirl';

// Animation 5: Waveform Pulse
const WaveformPulse = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const bars = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    id: i,
    angle: (i * 11.25),
  })), []);

  return (
    <>
      {/* Radial waveform bars */}
      {bars.map((bar) => {
        const freq = bar.id % 4 === 0 ? bass : bar.id % 4 === 1 ? mid : bar.id % 4 === 2 ? high : (bass + mid) / 2;
        const height = 30 + freq * 100;
        
        return (
          <motion.div
            key={bar.id}
            className="absolute left-1/2 top-1/2 origin-bottom"
            style={{
              width: '4px',
              height: `${height}px`,
              background: `linear-gradient(to top, 
                hsl(var(--primary)) 0%, 
                hsl(var(--primary) / 0.6) 50%, 
                hsl(var(--primary) / 0.2) 100%)`,
              transform: `translate(-50%, -100%) rotate(${bar.angle}deg) translateY(-60px)`,
              borderRadius: '2px',
              boxShadow: `0 0 ${8 + freq * 15}px hsl(var(--primary) / 0.7)`,
            }}
            animate={{
              scaleY: [0.4, 1, 0.4],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.1,
              repeat: Infinity,
              delay: bar.id * 0.01,
            }}
          />
        );
      })}

      {/* Center pulse */}
      <motion.div
        className="absolute inset-[30%] rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)`,
          boxShadow: `0 0 ${40 + bass * 60}px hsl(var(--primary) / 0.8)`,
        }}
        animate={{
          scale: [0.8, 1.3 + bass * 0.4, 0.8],
        }}
        transition={{ duration: 0.12, repeat: Infinity }}
      />

      {/* Outer ring */}
      <motion.div
        className="absolute inset-[-25%] rounded-full border-2"
        style={{
          borderColor: `hsl(var(--primary) / 0.5)`,
        }}
        animate={{
          scale: [1, 1.1 + mid * 0.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
    </>
  );
});
WaveformPulse.displayName = 'WaveformPulse';

// Animation 6: Digital Glitch Matrix
const DigitalGlitchMatrix = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const [glitchOffset, setGlitchOffset] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (bass > 0.5) {
        setGlitchOffset({
          x: (Math.random() - 0.5) * 20 * bass,
          y: (Math.random() - 0.5) * 20 * bass,
        });
      } else {
        setGlitchOffset({ x: 0, y: 0 });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [bass]);

  const lines = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    y: i * 5,
  })), []);

  return (
    <>
      {/* Scan lines */}
      {lines.map((line) => (
        <motion.div
          key={line.id}
          className="absolute left-0 right-0 h-[2px]"
          style={{
            top: `${line.y}%`,
            background: `linear-gradient(90deg, 
              transparent 0%, 
              hsl(var(--primary) / ${0.1 + (line.id % 3 === 0 ? bass : mid) * 0.4}) 50%, 
              transparent 100%)`,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scaleX: [0.8, 1.1 + high * 0.2, 0.8],
          }}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            delay: line.id * 0.02,
          }}
        />
      ))}

      {/* Glitch boxes */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`glitch-${i}`}
          className="absolute"
          style={{
            left: `${20 + i * 25}%`,
            top: `${30 + i * 15}%`,
            width: `${30 + bass * 20}%`,
            height: `${15 + mid * 10}%`,
            background: `hsl(var(--primary) / ${0.2 + bass * 0.3})`,
            mixBlendMode: 'screen',
          }}
          animate={{
            x: glitchOffset.x * (i + 1) * 0.5,
            y: glitchOffset.y * (i + 1) * 0.5,
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{ duration: 0.08 }}
        />
      ))}

      {/* RGB split effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(45deg, 
            hsla(0, 100%, 50%, ${0.05 + bass * 0.1}) 0%, 
            transparent 33%, 
            hsla(120, 100%, 50%, ${0.05 + mid * 0.1}) 66%, 
            hsla(240, 100%, 50%, ${0.05 + high * 0.1}) 100%)`,
          mixBlendMode: 'overlay',
        }}
        animate={{
          x: [0, glitchOffset.x * 2, 0],
        }}
        transition={{ duration: 0.1 }}
      />

      {/* Center core */}
      <motion.div
        className="absolute inset-[20%] rounded-xl"
        style={{
          border: `2px solid hsl(var(--primary) / ${0.6 + bass * 0.4})`,
          boxShadow: `
            0 0 ${20 + bass * 40}px hsl(var(--primary) / 0.5),
            inset 0 0 ${15 + mid * 30}px hsl(var(--primary) / 0.3)`,
        }}
        animate={{
          scale: [1, 1.05 + bass * 0.1, 1],
        }}
        transition={{ duration: 0.1, repeat: Infinity }}
      />
    </>
  );
});
DigitalGlitchMatrix.displayName = 'DigitalGlitchMatrix';

// Animation 7: Fire Aura
const FireAura = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const flames = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: i * 15,
    height: 60 + Math.random() * 40,
    delay: i * 0.03,
  })), []);

  return (
    <>
      {/* Fire flames */}
      {flames.map((flame) => {
        const freq = flame.id % 3 === 0 ? bass : flame.id % 3 === 1 ? mid : high;
        
        return (
          <motion.div
            key={flame.id}
            className="absolute left-1/2 top-1/2 origin-bottom"
            style={{
              width: `${8 + freq * 12}px`,
              height: `${flame.height + freq * 80}px`,
              background: `linear-gradient(to top, 
                hsl(var(--primary)) 0%, 
                hsl(var(--primary) / 0.7) 40%, 
                hsl(var(--primary) / 0.3) 70%, 
                transparent 100%)`,
              transform: `translate(-50%, -100%) rotate(${flame.angle}deg) translateY(-50px)`,
              borderRadius: '50% 50% 20% 20%',
              filter: `blur(${3 + freq * 5}px)`,
            }}
            animate={{
              scaleY: [0.6, 1 + freq * 0.6, 0.6],
              scaleX: [0.8, 1.2, 0.8],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 0.12,
              repeat: Infinity,
              delay: flame.delay,
            }}
          />
        );
      })}

      {/* Inner heat glow */}
      <motion.div
        className="absolute inset-[10%] rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsl(var(--primary) / ${0.9 + bass * 0.1}) 0%, 
            hsl(var(--primary) / 0.4) 50%, 
            transparent 70%)`,
          filter: `blur(${15 + bass * 25}px)`,
        }}
        animate={{
          scale: [1, 1.3 + bass * 0.4, 1],
        }}
        transition={{ duration: 0.1, repeat: Infinity }}
      />

      {/* Heat distortion ring */}
      <motion.div
        className="absolute inset-[-15%] rounded-full"
        style={{
          border: `3px solid hsl(var(--primary) / ${0.4 + mid * 0.3})`,
          boxShadow: `0 0 ${40 + bass * 60}px hsl(var(--primary) / 0.6)`,
        }}
        animate={{
          scale: [1, 1.15 + bass * 0.2, 1],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{ duration: 0.15, repeat: Infinity }}
      />
    </>
  );
});
FireAura.displayName = 'FireAura';

// Animation 8: Cosmic Rings
const CosmicRings = memo(({ bass, mid, high }: { bass: number; mid: number; high: number }) => {
  const rings = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    radius: 30 + i * 20,
    rotation: i * 36,
    tilt: 60 + i * 5,
  })), []);

  return (
    <>
      {/* 3D tilted rings */}
      <div 
        className="absolute inset-[-20%]"
        style={{ perspective: '600px', perspectiveOrigin: 'center' }}
      >
        {rings.map((ring) => {
          const freq = ring.id % 3 === 0 ? bass : ring.id % 3 === 1 ? mid : high;
          
          return (
            <motion.div
              key={ring.id}
              className="absolute inset-0 rounded-full border-2"
              style={{
                borderColor: `hsl(var(--primary) / ${0.5 + freq * 0.5})`,
                boxShadow: `0 0 ${15 + freq * 25}px hsl(var(--primary) / ${0.4 + freq * 0.3})`,
                transform: `rotateX(${ring.tilt}deg) rotateZ(${ring.rotation}deg) scale(${0.5 + ring.id * 0.12})`,
              }}
              animate={{
                rotateZ: [ring.rotation, ring.rotation + 360],
                scale: [0.5 + ring.id * 0.12, 0.55 + ring.id * 0.12 + freq * 0.15, 0.5 + ring.id * 0.12],
              }}
              transition={{
                rotateZ: { duration: 6 + ring.id, repeat: Infinity, ease: 'linear' },
                scale: { duration: 0.12, repeat: Infinity },
              }}
            />
          );
        })}
      </div>

      {/* Orbiting particles */}
      {Array.from({ length: 8 }, (_, i) => (
        <motion.div
          key={`orbit-${i}`}
          className="absolute w-3 h-3 rounded-full"
          style={{
            left: '50%',
            top: '50%',
            background: `radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)`,
            boxShadow: `0 0 10px hsl(var(--primary))`,
          }}
          animate={{
            x: Math.cos((i * 45 + Date.now() * 0.002) * Math.PI / 180) * (100 + bass * 40) - 6,
            y: Math.sin((i * 45 + Date.now() * 0.002) * Math.PI / 180) * (100 + bass * 40) - 6,
            scale: [1, 1.5 + high * 0.5, 1],
          }}
          transition={{
            x: { duration: 4 + i * 0.5, repeat: Infinity, ease: 'linear' },
            y: { duration: 4 + i * 0.5, repeat: Infinity, ease: 'linear' },
            scale: { duration: 0.15, repeat: Infinity },
          }}
        />
      ))}

      {/* Core glow */}
      <motion.div
        className="absolute inset-[25%] rounded-full"
        style={{
          background: `radial-gradient(circle, 
            hsl(var(--primary)) 0%, 
            hsl(var(--primary) / 0.5) 40%, 
            transparent 70%)`,
          boxShadow: `0 0 ${50 + bass * 70}px hsl(var(--primary) / 0.7)`,
        }}
        animate={{
          scale: [1, 1.4 + bass * 0.5, 1],
        }}
        transition={{ duration: 0.1, repeat: Infinity }}
      />
    </>
  );
});
CosmicRings.displayName = 'CosmicRings';

const AlbumArtAnimations = memo(({ isPlaying, bassFrequency, midFrequency, highFrequency, songId }: AlbumArtAnimationsProps) => {
  const animationType = useMemo(() => getAnimationType(songId), [songId]);

  if (!isPlaying) return null;

  const props = { bass: bassFrequency, mid: midFrequency, high: highFrequency };

  switch (animationType) {
    case 0:
      return <ElectricPulseStorm {...props} />;
    case 1:
      return <LiquidMorphingBlob {...props} />;
    case 2:
      return <ParticleExplosion {...props} />;
    case 3:
      return <NebulaSwirl {...props} />;
    case 4:
      return <WaveformPulse {...props} />;
    case 5:
      return <DigitalGlitchMatrix {...props} />;
    case 6:
      return <FireAura {...props} />;
    case 7:
      return <CosmicRings {...props} />;
    default:
      return <ElectricPulseStorm {...props} />;
  }
});

AlbumArtAnimations.displayName = 'AlbumArtAnimations';

export default AlbumArtAnimations;
