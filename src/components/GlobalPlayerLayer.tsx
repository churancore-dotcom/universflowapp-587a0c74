import { memo, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import MiniPlayer from './MiniPlayer';

const FullscreenPlayer = lazy(() => import('./FullscreenPlayer'));

/**
 * App-level mount for MiniPlayer + FullscreenPlayer.
 * Persisting these across route changes prevents the mount/unmount
 * flicker that happened when each page mounted its own copy.
 */
const GlobalPlayerLayer = memo(function GlobalPlayerLayer() {
  const { pathname } = useLocation();

  // Hide on routes where the player UI shouldn't appear
  const hidden =
    pathname === '/' ||
    pathname === '/auth' ||
    pathname.startsWith('/admin') ||
    pathname === '/offline-player';

  if (hidden) return null;

  return (
    <>
      <MiniPlayer />
      <Suspense fallback={null}>
        <FullscreenPlayer />
      </Suspense>
    </>
  );
});

export default GlobalPlayerLayer;
