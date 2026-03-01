import { useState, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const slides = [
  {
    emoji: '🎵',
    title: 'Discover Music',
    subtitle: 'Stream unlimited songs from your favorite artists with crystal-clear audio quality.',
    gradient: 'from-rose-500 via-pink-500 to-purple-600',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, hsl(340 100% 50% / 0.2) 0%, transparent 50%)',
  },
  {
    emoji: '📲',
    title: 'Listen Offline',
    subtitle: 'Download songs and enjoy your music anywhere — no internet required.',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, hsl(200 100% 50% / 0.2) 0%, transparent 50%)',
  },
  {
    emoji: '🎧',
    title: 'Premium Experience',
    subtitle: 'Equalizer, lyrics, social sharing, and a beautiful player designed for you.',
    gradient: 'from-purple-500 via-violet-500 to-indigo-600',
    bgGradient: 'radial-gradient(ellipse at 50% 30%, hsl(270 100% 60% / 0.2) 0%, transparent 50%)',
  },
];

const Onboarding = forwardRef<HTMLDivElement, OnboardingProps>(({ onComplete }, ref) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  const handleNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  }, [currentSlide, onComplete]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else if (info.offset.x > threshold && currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  }, [currentSlide]);

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div ref={ref} className="h-[100dvh] bg-background flex flex-col relative overflow-hidden">
      {/* Static background gradient — no blur filters */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-500"
        style={{ background: slide.bgGradient }}
      />

      {/* Skip button */}
      <div className="relative z-20 flex justify-end p-4 safe-area-pt">
        <button
          onClick={onComplete}
          className="px-4 py-2 rounded-full text-xs font-medium text-muted-foreground tracking-wider uppercase active:scale-95 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 relative z-10"
        style={{ touchAction: 'pan-y' }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="flex flex-col items-center text-center w-full"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
          >
            {/* Icon container — static glow, no rotation */}
            <motion.div
              className="relative mb-8"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
            >
              <div
                className={`w-28 h-28 rounded-3xl flex items-center justify-center relative bg-gradient-to-br ${slide.gradient}`}
                style={{ boxShadow: '0 15px 40px rgba(0,0,0,0.3)' }}
              >
                <span className="text-5xl">{slide.emoji}</span>
              </div>
            </motion.div>

            <motion.h2
              className="text-3xl font-bold text-foreground mb-3 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              {slide.title}
            </motion.h2>

            <motion.p
              className="text-muted-foreground text-base leading-relaxed max-w-[280px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {slide.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 px-8 pb-10 safe-area-pb">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === currentSlide ? 24 : 8,
                background: i === currentSlide
                  ? 'linear-gradient(135deg, #FF2D55, #BF5AF2)'
                  : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={handleNext}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-primary-foreground active:scale-[0.97] transition-transform"
          style={{
            background: isLast
              ? 'linear-gradient(135deg, #FF2D55, #BF5AF2, #5E5CE6)'
              : 'rgba(255,255,255,0.08)',
            color: isLast ? '#fff' : 'rgba(255,255,255,0.9)',
            border: isLast ? 'none' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: isLast ? '0 4px 20px hsl(340 100% 50% / 0.25)' : 'none',
          }}
        >
          {isLast ? (
            <>
              Get Started
              <Sparkles className="w-5 h-5" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
});
Onboarding.displayName = 'Onboarding';

export default Onboarding;