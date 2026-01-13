import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useLike } from '@/hooks/useLike';
import { iosBounce } from '@/lib/animations';

interface LikeButtonProps {
  songId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const iconSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const LikeButton = memo(({ songId, size = 'md', className = '' }: LikeButtonProps) => {
  const { isLiked, isLoading, toggleLike } = useLike(songId);

  return (
    <motion.button
      className={`rounded-full flex items-center justify-center relative transition-colors ${sizeClasses[size]} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleLike();
      }}
      whileTap={{ scale: 0.9 }}
      transition={iosBounce}
      disabled={isLoading}
    >
      <Heart
        className={`${iconSizes[size]} transition-colors ${
          isLiked 
            ? 'text-primary fill-primary' 
            : 'text-muted-foreground hover:text-primary'
        }`}
        fill={isLiked ? 'currentColor' : 'none'}
      />
    </motion.button>
  );
});

LikeButton.displayName = 'LikeButton';

export default LikeButton;
