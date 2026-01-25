import { memo, ReactNode, Children, isValidElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerGrid, staggerGridItem, smoothReveal } from '@/lib/animations';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  type?: 'stagger' | 'fade';
  delay?: number;
}

const AnimatedList = memo(({
  children,
  className = '',
  type = 'stagger',
  delay = 0,
}: AnimatedListProps) => {
  const variants = type === 'stagger' ? staggerGrid : {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: delay,
      },
    },
  };

  const itemVariants = type === 'stagger' ? staggerGridItem : smoothReveal;

  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      <AnimatePresence mode="popLayout">
        {Children.map(children, (child, index) => {
          if (!isValidElement(child)) return child;
          
          return (
            <motion.div
              key={child.key || index}
              variants={itemVariants}
              layout
            >
              {child}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
});

AnimatedList.displayName = 'AnimatedList';

// Wrapper for individual animated items
export const AnimatedItem = memo(({
  children,
  className = '',
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
          type: "spring",
          stiffness: 400,
          damping: 25,
          delay: index * 0.05,
        },
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.95,
        transition: { duration: 0.15 },
      }}
      layout
    >
      {children}
    </motion.div>
  );
});

AnimatedItem.displayName = 'AnimatedItem';

export default AnimatedList;
