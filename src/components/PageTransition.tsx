import { motion, Transition } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageSpring: Transition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 38,
  mass: 0.6,
};

const pageTiming: Transition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94], // iOS ease-out curve
};

const PageTransition = ({ children, className = '' }: PageTransitionProps) => {
  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0, 
        x: 60,
        scale: 0.98,
      }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: 1,
      }}
      exit={{ 
        opacity: 0, 
        x: -30,
        scale: 0.98,
      }}
      transition={pageSpring}
    >
      {children}
    </motion.div>
  );
};

// For modal/sheet style pages (like settings, profile)
export const SheetTransition = ({ children, className = '' }: PageTransitionProps) => {
  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0, 
        y: "8%",
        scale: 0.96,
      }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: 1,
      }}
      exit={{ 
        opacity: 0, 
        y: "5%",
        scale: 0.98,
      }}
      transition={pageSpring}
    >
      {children}
    </motion.div>
  );
};

// For fade transitions (auth, splash)
export const FadeTransition = forwardRef<HTMLDivElement, PageTransitionProps>(({ children, className = '' }, ref) => {
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={pageTiming}
    >
      {children}
    </motion.div>
  );
});
FadeTransition.displayName = 'FadeTransition';

// For tab-style navigation (home, search, library) - smoother fade
export const TabTransition = ({ children, className = '' }: PageTransitionProps) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
