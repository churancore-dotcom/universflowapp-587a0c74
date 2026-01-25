import { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { microBounce, iconPop } from '@/lib/animations';
import { useHaptics } from '@/hooks/useHaptics';

interface AnimatedIconProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  haptic?: boolean;
  bounce?: boolean;
  glow?: boolean;
}

const AnimatedIcon = memo(({
  children,
  className = '',
  onClick,
  isActive = false,
  haptic = true,
  bounce = true,
  glow = false,
}: AnimatedIconProps) => {
  const { trigger } = useHaptics();

  const handleClick = () => {
    if (haptic) {
      trigger('impactLight');
    }
    onClick?.();
  };

  return (
    <motion.button
      className={`relative flex items-center justify-center transition-colors ${className}`}
      onClick={handleClick}
      whileTap={bounce ? { scale: 0.85 } : undefined}
      transition={microBounce}
      {...(bounce ? iconPop : {})}
    >
      {/* Glow effect for active state */}
      {glow && isActive && (
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.2, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      
      {/* Icon container */}
      <motion.div
        animate={isActive ? { scale: 1.1 } : { scale: 1 }}
        transition={microBounce}
      >
        {children}
      </motion.div>
    </motion.button>
  );
});

AnimatedIcon.displayName = 'AnimatedIcon';

export default AnimatedIcon;
