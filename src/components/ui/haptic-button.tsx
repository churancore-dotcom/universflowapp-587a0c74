import React, { forwardRef, useCallback } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { triggerHaptic } from '@/hooks/useHaptics';

type HapticStyle = 'impactLight' | 'impactMedium' | 'impactHeavy' | 'selection';

// iOS-optimized spring configuration
const iosSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
  mass: 0.5,
};

interface HapticButtonProps extends Omit<HTMLMotionProps<"button">, 'onTap'> {
  hapticStyle?: HapticStyle;
  scaleOnTap?: number;
  children: React.ReactNode;
}

const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ hapticStyle = 'impactLight', scaleOnTap = 0.92, onClick, children, className, ...props }, ref) => {
    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      triggerHaptic(hapticStyle);
      onClick?.(e as any);
    }, [hapticStyle, onClick]);

    return (
      <motion.button
        ref={ref}
        className={className}
        onClick={handleClick}
        whileTap={{ scale: scaleOnTap }}
        transition={iosSpring}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

HapticButton.displayName = 'HapticButton';

export { HapticButton };
export default HapticButton;
