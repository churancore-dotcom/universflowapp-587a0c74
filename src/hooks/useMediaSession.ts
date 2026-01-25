import { useEffect, useRef } from 'react';
import { Song } from '@/contexts/PlayerContext';

interface UseMediaSessionOptions {
  song: Song | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek?: (time: number) => void;
  onStop?: () => void;
  duration?: number;
  progress?: number;
}

export const useMediaSession = ({
  song,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onStop,
  duration = 0,
  progress = 0,
}: UseMediaSessionOptions) => {
  const lastPositionUpdate = useRef(0);
  const updateInterval = useRef<number | null>(null);

  // Update metadata when song changes
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (song) {
      // Create artwork array with multiple sizes for better display
      const artwork = song.cover_url ? [
        { src: song.cover_url, sizes: '96x96', type: 'image/jpeg' },
        { src: song.cover_url, sizes: '128x128', type: 'image/jpeg' },
        { src: song.cover_url, sizes: '192x192', type: 'image/jpeg' },
        { src: song.cover_url, sizes: '256x256', type: 'image/jpeg' },
        { src: song.cover_url, sizes: '384x384', type: 'image/jpeg' },
        { src: song.cover_url, sizes: '512x512', type: 'image/jpeg' },
      ] : [];

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: song.album || 'Univers Flow',
          artwork,
        });
      } catch (error) {
        console.warn('Failed to set media metadata:', error);
      }
    }
  }, [song]);

  // Update playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (error) {
      // Ignore playback state errors
    }
  }, [isPlaying]);

  // Set up action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => onPlay()],
      ['pause', () => onPause()],
      ['previoustrack', () => onPrev()],
      ['nexttrack', () => onNext()],
      ['stop', onStop ? () => onStop() : null],
    ];

    // Add seek handlers if seek function is provided
    if (onSeek) {
      handlers.push(
        ['seekto', (details) => {
          if (details.seekTime !== undefined) {
            onSeek(details.seekTime);
          }
        }],
        ['seekbackward', (details) => {
          const skipTime = details.seekOffset || 10;
          onSeek(Math.max(progress - skipTime, 0));
        }],
        ['seekforward', (details) => {
          const skipTime = details.seekOffset || 10;
          onSeek(Math.min(progress + skipTime, duration));
        }]
      );
    }

    // Register all handlers
    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Some actions may not be supported
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore cleanup errors
        }
      });
    };
  }, [onPlay, onPause, onNext, onPrev, onSeek, onStop, progress, duration]);

  // Update position state with throttling for better performance
  useEffect(() => {
    if (!('mediaSession' in navigator) || !song) return;

    // Throttle position updates to avoid excessive calls
    const now = Date.now();
    if (now - lastPositionUpdate.current < 1000) return;
    lastPositionUpdate.current = now;

    try {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: 1,
        position: Math.min(Math.max(0, progress), duration || 0),
      });
    } catch (error) {
      // Position state update failed, ignore
    }
  }, [progress, duration, song]);

  // Set up periodic position updates while playing
  useEffect(() => {
    if (!('mediaSession' in navigator) || !song || !isPlaying) {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
      return;
    }

    // Update position every second while playing
    updateInterval.current = window.setInterval(() => {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration || 0,
          playbackRate: 1,
          position: Math.min(Math.max(0, progress), duration || 0),
        });
      } catch {
        // Ignore errors
      }
    }, 1000);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
    };
  }, [isPlaying, song, duration, progress]);
};

export default useMediaSession;
