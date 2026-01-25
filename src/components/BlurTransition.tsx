import { memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { blurFade, originOS6Spring } from '@/lib/animations';

interface BlurTransitionProps {
  children: ReactNode;
  isVisible: boolean;
  className?: string;
  type?: 'blur' | 'scale' | 'slide';
}

const BlurTransition = memo(({
  children,
  isVisible,
  className = '',
  type = 'blur',
}: BlurTransitionProps) => {
  const variants = {
    blur: blurFade,
    scale: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { 
        opacity: 1, 
        scale: 1,
        transition: originOS6Spring,
      },
      exit: { 
        opacity: 0, 
        scale: 0.95,
        transition: { duration: 0.2 },
      },
    },
    slide: {
      initial: { opacity: 0, y: 30 },
      animate: { 
        opacity: 1, 
        y: 0,
        transition: originOS6Spring,
      },
      exit: { 
        opacity: 0, 
        y: -20,
        transition: { duration: 0.2 },
      },
    },
  };

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className={className}
          variants={variants[type]}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

BlurTransition.displayName = 'BlurTransition';

export default BlurTransition;
