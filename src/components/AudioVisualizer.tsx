import { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { iosSpring } from '@/lib/animations';

interface AudioVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
}

type VisualizerMode = 'bars' | 'wave' | 'circular' | 'particles';

const modes: { id: VisualizerMode; label: string }[] = [
  { id: 'bars', label: 'Bars' },
  { id: 'wave', label: 'Wave' },
  { id: 'circular', label: 'Circular' },
  { id: 'particles', label: 'Particles' },
];

const AudioVisualizer = memo(({ isOpen, onClose }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { currentSong, isPlaying } = usePlayer();
  const [mode, setMode] = useState<VisualizerMode>('bars');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fakeData, setFakeData] = useState<number[]>(Array(64).fill(0));

  // Simulate audio data since we can't easily access the audio element's analyser
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const interval = setInterval(() => {
      setFakeData(prev => 
        prev.map((_, i) => {
          const base = Math.sin(Date.now() / 500 + i * 0.5) * 0.3 + 0.5;
          const random = Math.random() * 0.4;
          return Math.min(1, base + random);
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, isPlaying]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (!isPlaying) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const data = fakeData;
      const centerX = width / 2;
      const centerY = height / 2;

      switch (mode) {
        case 'bars':
          drawBars(ctx, data, width, height);
          break;
        case 'wave':
          drawWave(ctx, data, width, height);
          break;
        case 'circular':
          drawCircular(ctx, data, centerX, centerY, Math.min(width, height) * 0.35);
          break;
        case 'particles':
          drawParticles(ctx, data, width, height);
          break;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, isPlaying, mode, fakeData]);

  const drawBars = (ctx: CanvasRenderingContext2D, data: number[], width: number, height: number) => {
    const barCount = 32;
    const barWidth = width / barCount - 4;
    const barSpacing = 4;

    for (let i = 0; i < barCount; i++) {
      const value = data[i * 2] || 0;
      const barHeight = value * height * 0.8;
      const x = i * (barWidth + barSpacing);
      const y = height - barHeight;

      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(x, height, x, y);
      gradient.addColorStop(0, 'hsl(280, 100%, 60%)');
      gradient.addColorStop(0.5, 'hsl(320, 100%, 55%)');
      gradient.addColorStop(1, 'hsl(340, 100%, 60%)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 4);
      ctx.fill();

      // Add glow effect
      ctx.shadowColor = 'hsl(300, 100%, 50%)';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const drawWave = (ctx: CanvasRenderingContext2D, data: number[], width: number, height: number) => {
    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'hsl(200, 100%, 60%)');
    gradient.addColorStop(0.5, 'hsl(280, 100%, 60%)');
    gradient.addColorStop(1, 'hsl(340, 100%, 60%)');

    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * width;
      const y = height / 2 + (data[i] - 0.5) * height * 0.6;
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'hsl(280, 100%, 60%)';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Mirror wave
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * width;
      const y = height / 2 - (data[i] - 0.5) * height * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawCircular = (ctx: CanvasRenderingContext2D, data: number[], centerX: number, centerY: number, radius: number) => {
    const points = 64;
    
    // Outer ring
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const value = data[i % data.length] || 0;
      const r = radius + value * 60;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
    gradient.addColorStop(0, 'hsl(280, 100%, 60%)');
    gradient.addColorStop(1, 'hsl(340, 100%, 50%)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'hsl(300, 100%, 60%)';
    ctx.shadowBlur = 25;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, data: number[], width: number, height: number) => {
    const time = Date.now() / 1000;
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const value = data[i % data.length] || 0;
      const angle = (i / particleCount) * Math.PI * 2 + time * 0.5;
      const distance = 100 + value * 150 + Math.sin(time + i) * 30;
      const x = width / 2 + Math.cos(angle) * distance;
      const y = height / 2 + Math.sin(angle) * distance;
      const size = 3 + value * 8;

      const hue = 280 + (i / particleCount) * 60;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.5 + value * 0.5})`;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 15;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Album art background */}
        {currentSong?.cover_url && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.3, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <img
              src={currentSong.cover_url}
              alt=""
              className="w-full h-full object-cover blur-3xl saturate-150"
            />
          </motion.div>
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Controls overlay */}
        <div className="absolute inset-x-0 top-0 p-6 flex items-center justify-between safe-area-pt">
          <motion.button
            onClick={onClose}
            className="w-12 h-12 rounded-full flex items-center justify-center glass"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={iosSpring}
          >
            <X className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={toggleFullscreen}
            className="w-12 h-12 rounded-full flex items-center justify-center glass"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={iosSpring}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        {/* Mode selector */}
        <div className="absolute inset-x-0 bottom-0 p-6 safe-area-pb">
          <div className="flex items-center justify-center gap-2">
            {modes.map((m) => (
              <motion.button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  mode === m.id
                    ? 'bg-white text-black'
                    : 'glass text-white/70 hover:text-white'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={iosSpring}
              >
                {m.label}
              </motion.button>
            ))}
          </div>

          {/* Song info */}
          {currentSong && (
            <motion.div
              className="text-center mt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xl font-bold">{currentSong.title}</h2>
              <p className="text-white/60 mt-1">{currentSong.artist}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';

export default AudioVisualizer;
