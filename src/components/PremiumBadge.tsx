import { memo } from 'react';
import { Crown } from 'lucide-react';

interface PremiumBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

/**
 * Universal Premium chip — Apple Music style gold gradient.
 * Use anywhere a premium user is shown (profile, comments, share cards).
 */
const PremiumBadge = memo(function PremiumBadge({
  size = 'xs',
  showIcon = true,
  className = '',
}: PremiumBadgeProps) {
  const sizes = {
    xs: { pad: 'px-1.5 py-0.5', text: 'text-[8px]', icon: 'w-2 h-2' },
    sm: { pad: 'px-2 py-0.5', text: 'text-[10px]', icon: 'w-2.5 h-2.5' },
    md: { pad: 'px-2.5 py-1', text: 'text-xs', icon: 'w-3 h-3' },
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ${sizes.pad} ${sizes.text} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%)',
        color: '#1a1a1a',
        boxShadow: '0 1px 4px rgba(245, 158, 11, 0.35)',
      }}
      aria-label="Premium member"
    >
      {showIcon && <Crown className={sizes.icon} fill="#1a1a1a" />}
      Premium
    </span>
  );
});

export default PremiumBadge;
