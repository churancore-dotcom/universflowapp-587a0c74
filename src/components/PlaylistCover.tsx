import { Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaylistCoverProps {
  coverUrl?: string | null;
  coverUrls?: (string | null | undefined)[];
  className?: string;
  rounded?: string;
  iconClassName?: string;
}

/**
 * YouTube-style stacked playlist cover.
 * Shows the top track artwork with up to 2 prior covers peeking behind
 * (offset + scaled), giving a layered "stack of cards" effect.
 * Falls back to a gradient + music icon when no artwork is available.
 */
const PlaylistCover = ({
  coverUrl,
  coverUrls,
  className,
  rounded = 'rounded-2xl',
  iconClassName = 'w-1/3 h-1/3 text-white/40',
}: PlaylistCoverProps) => {
  const unique = Array.from(
    new Set((coverUrls || []).filter((url): url is string => !!url))
  );
  // Prefer explicit cover_url at the front; fall back to derived first artwork
  const front = coverUrl || unique[0] || null;
  const backStack = unique.filter((url) => url !== front).slice(0, 2);

  return (
    <div
      className={cn('relative overflow-hidden', rounded, className)}
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.35), hsl(var(--accent) / 0.35))',
      }}
    >
      {/* Back layers (peek from top) */}
      {backStack[1] && (
        <div
          className={cn('absolute inset-0 overflow-hidden', rounded)}
          style={{
            transform: 'translateY(-14%) scale(0.78)',
            transformOrigin: 'top center',
            opacity: 0.55,
            filter: 'blur(0.5px)',
          }}
        >
          <img src={backStack[1]} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      {backStack[0] && (
        <div
          className={cn('absolute inset-0 overflow-hidden', rounded)}
          style={{
            transform: 'translateY(-8%) scale(0.88)',
            transformOrigin: 'top center',
            opacity: 0.78,
          }}
        >
          <img src={backStack[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Front layer */}
      {front ? (
        <img
          src={front}
          alt=""
          className={cn('absolute inset-0 w-full h-full object-cover', rounded)}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Music className={iconClassName} />
        </div>
      )}

      {/* Subtle top shadow so back layers feel layered */}
      {backStack.length > 0 && (
        <div
          className="absolute inset-x-0 top-0 h-6 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)',
          }}
        />
      )}
    </div>
  );
};

export default PlaylistCover;
