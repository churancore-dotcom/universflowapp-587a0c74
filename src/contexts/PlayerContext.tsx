import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useGlobalAudioEngine } from '@/hooks/useGlobalAudioEngine';
import { supabase } from '@/integrations/supabase/client';
import { resolveIndexedTrack, prefetchIndexedTrack } from '@/lib/musicIndexer';
import { playerProgressStore, usePlayerProgress } from '@/lib/playerProgressStore';
import { toast } from 'sonner';

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
  setVolume?: (volume: number) => void;
}

interface YouTubeAPI {
  Player: new (elementId: string | HTMLElement, config: Record<string, unknown>) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  audio_url: string;
  duration?: number;
  artist_id?: string;
  artist_photo_url?: string;
  play_count?: number;
  source?: 'library' | 'audius' | 'indexed';
}

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  queue: Song[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  isExpanded: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  audioElement: HTMLAudioElement | null;
  showPrerollAd: boolean;
  adType: 'start' | 'end';
  playSong: (song: Song, offlineUrl?: string | null, songsQueue?: Song[]) => void;
  togglePlay: () => void;
  pause: () => void;
  play: () => void;
  stopSong: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setQueue: (songs: Song[]) => void;
  addToQueue: (song: Song) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleCrossfade: () => void;
  setCrossfadeDuration: (seconds: number) => void;
  onPrerollAdComplete: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const EQ_SETTINGS_KEY = 'eq_settings';

const CORS_ENABLED_AUDIO_HOSTS = ['supabase.co', 'the-standard.io', 'private.coffee'];

const shouldUseAnonymousCors = (audioUrl?: string | null) => {
  if (!audioUrl) return false;
  if (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) return false;

  try {
    const parsed = new URL(audioUrl, window.location.href);
    return parsed.origin === window.location.origin || CORS_ENABLED_AUDIO_HOSTS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
};

const configureAudioElementSource = (audio: HTMLAudioElement, sourceUrl: string) => {
  if (shouldUseAnonymousCors(sourceUrl)) {
    audio.crossOrigin = 'anonymous';
  } else {
    audio.crossOrigin = null;
    audio.removeAttribute('crossorigin');
  }

  audio.src = sourceUrl;
};

// Hosts that already deliver proper CORS headers — safe to play & EQ-process directly.
// Keep this list MINIMAL: anything not here gets proxied through our edge function
// so the EQ / Web Audio graph can process it without tainting the audio.
const DIRECT_PLAYABLE_HOST_SNIPPETS = [
  'supabase.co',
];

const shouldProxyStreamUrl = (sourceUrl: string) => {
  if (!sourceUrl.startsWith('http')) return false;

  try {
    const parsed = new URL(sourceUrl, window.location.href);
    if (parsed.origin === window.location.origin) return false;
    if (sourceUrl.includes('/functions/v1/music-indexer?audio=')) return false;

    // Route ALL non-catalog streams through the CORS-enabled proxy so the
    // equalizer / Web Audio graph can process them without tainting.
    return !DIRECT_PLAYABLE_HOST_SNIPPETS.some((host) => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
};

// Cache the current access token so we can append it to <audio src> proxy URLs.
// (audio elements can't send custom Authorization headers.)
let cachedAccessToken: string | null = null;
supabase.auth.getSession().then(({ data }) => {
  cachedAccessToken = data.session?.access_token ?? null;
});
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

const buildStreamProxyUrl = (sourceUrl: string) => {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!projectUrl || !shouldProxyStreamUrl(sourceUrl)) return sourceUrl;
  const tokenParam = cachedAccessToken ? `&token=${encodeURIComponent(cachedAccessToken)}` : '';
  return `${projectUrl}/functions/v1/music-indexer?audio=${encodeURIComponent(sourceUrl)}${tokenParam}`;
};

const isEqProcessingEnabled = () => {
  try {
    const raw = localStorage.getItem(EQ_SETTINGS_KEY);
    if (!raw) return false;

    const settings = JSON.parse(raw);
    const hasBands = Array.isArray(settings?.bands) && settings.bands.some((gain: number) => Math.abs(gain) >= 0.5);

    return Boolean(
      hasBands ||
      settings?.bassBoost > 0 ||
      settings?.reverb > 0 ||
      settings?.spatialAudio ||
      (settings?.playbackSpeed && settings.playbackSpeed !== 1)
    );
  } catch {
    return false;
  }
};

const isYouTubeFallbackUrl = (url?: string | null) => Boolean(url?.startsWith('yt-video:'));

const getYouTubeFallbackVideoId = (url?: string | null) => {
  if (!isYouTubeFallbackUrl(url)) return null;
  return url?.replace('yt-video:', '').trim() || null;
};

let youtubeIframeApiPromise: Promise<typeof window.YT> | null = null;

const loadYouTubeIframeApi = (): Promise<typeof window.YT> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not available'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise;
  }

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api="true"]');

    const handleReady = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube player API did not initialize'));
      }
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      handleReady();
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => reject(new Error('Failed to load YouTube player API'));
      document.head.appendChild(script);
    }
  });

  return youtubeIframeApiPromise;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // progress/duration live in an external store (playerProgressStore) so the
  // 250ms tick doesn't rerender every component using usePlayer().
  const setProgress = (v: number | ((prev: number) => number)) => {
    const next = typeof v === 'function' ? (v as (p: number) => number)(playerProgressStore.getProgress()) : v;
    playerProgressStore.setProgress(next);
  };
  const setDuration = (v: number) => playerProgressStore.setDuration(v);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [isExpanded, setExpanded] = useState(false);
  const [crossfade, setCrossfade] = useState(false);
  const [crossfadeDuration, setCrossfadeDurationState] = useState(3);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showPrerollAd, setShowPrerollAd] = useState(false);
  const [adType, setAdType] = useState<'start' | 'end'>('start');
  const [pendingSong, setPendingSong] = useState<{ song: Song; offlineUrl?: string | null; songsQueue?: Song[] } | null>(null);
  const [songsPlayedSinceAd, setSongsPlayedSinceAd] = useState(0);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const AD_FREQUENCY = 3; // Show ad every 3 songs
  
  // Single audio element - simpler approach
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const isCrossfading = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const recentlyPlayedTimerRef = useRef<number | null>(null);
  const queueRestoredRef = useRef(false);

  // YouTube IFrame fallback
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubeProgressRef = useRef<number | null>(null);
  const youtubeActiveRef = useRef(false);
  const youtubeEndCallbackRef = useRef<(() => void) | null>(null);

  // ── Persist queue across reloads ──
  useEffect(() => {
    if (queueRestoredRef.current) return;
    queueRestoredRef.current = true;
    try {
      const raw = localStorage.getItem('player_queue_state');
      if (!raw) return;
      const saved = JSON.parse(raw) as { queue: Song[]; index: number; song: Song | null };
      if (Array.isArray(saved.queue) && saved.queue.length > 0) {
        setQueueState(saved.queue);
        setCurrentIndex(Math.max(0, Math.min(saved.index || 0, saved.queue.length - 1)));
        if (saved.song) setCurrentSong(saved.song);
      }
    } catch { /* ignore corrupt cache */ }
  }, []);

  useEffect(() => {
    if (!queueRestoredRef.current) return;
    try {
      const trimmed = queue.slice(0, 100);
      localStorage.setItem('player_queue_state', JSON.stringify({
        queue: trimmed,
        index: Math.min(currentIndex, trimmed.length - 1),
        song: currentSong,
      }));
    } catch { /* quota or disabled */ }
  }, [queue, currentIndex, currentSong]);

  // Check premium status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsPremiumUser(false);
          return;
        }

        const { data } = await supabase
          .from('user_subscriptions')
          .select('subscription_type, status, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
          const isPremium = data.subscription_type !== 'free' && data.status === 'active' && !isExpired;
          setIsPremiumUser(isPremium);
        } else {
          setIsPremiumUser(false);
        }
      } catch {
        setIsPremiumUser(false);
      }
    };
    checkStatus();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track whether audio was playing before going to background
  const wasPlayingRef = useRef(false);
  const keepAliveRef = useRef<number | null>(null);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    
    audioRef.current = audio;
    setAudioElement(audio);

    // Create second audio for crossfade
    const nextAudio = new Audio();
    nextAudio.volume = 0;
    nextAudio.preload = 'auto';
    nextAudio.setAttribute('playsinline', 'true');
    nextAudio.setAttribute('webkit-playsinline', 'true');
    nextAudioRef.current = nextAudio;

    // Track playing state before going to background
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Entering background — remember if we were playing
        wasPlayingRef.current = !!(audioRef.current && !audioRef.current.paused);
      } else if (document.visibilityState === 'visible') {
        // Returning to foreground — resume if was playing
        if (wasPlayingRef.current && audioRef.current && audioRef.current.paused && audioRef.current.src) {
          audioRef.current.play().catch(() => {});
        }
      }
    };
    
    const handleFocus = () => {
      if (audioRef.current && audioRef.current.src && audioRef.current.paused && wasPlayingRef.current) {
        audioRef.current.play().catch(() => {});
      }
    };

    // Keep-alive: touch audio buffer every 5s to prevent browser from suspending
    keepAliveRef.current = window.setInterval(() => {
      if (audioRef.current && !audioRef.current.paused && audioRef.current.readyState >= 2) {
        // Touch the currentTime to keep the audio pipeline active
        const _ = audioRef.current.currentTime;
      }
    }, 5000);

    // Handle buffering stalls — nudge playback
    const handleWaiting = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setTimeout(() => {
          if (audioRef.current && audioRef.current.readyState < 3 && !audioRef.current.paused) {
            // Nudge currentTime slightly to unstall
            audioRef.current.currentTime = audioRef.current.currentTime;
          }
        }, 2000);
      }
    };

    audio.addEventListener('waiting', handleWaiting);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Native app resume — only fires inside Capacitor APK. Web preview ignores.
    let appResumeRemove: (() => void) | null = null;
    (async () => {
      try {
        const modName = '@capacitor/app';
        const mod: any = await import(/* @vite-ignore */ modName).catch(() => null);
        if (!mod?.App) return;
        const handle = await mod.App.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (!state?.isActive) return;
          // Returning to foreground from native background:
          // 1) clear any stale 'error' UI state by re-checking the audio element
          // 2) resume if we were playing
          const a = audioRef.current;
          if (!a) return;
          // If readyState dropped below HAVE_CURRENT_DATA, re-prime by reassigning currentTime
          if (a.src && a.readyState < 2) {
            try { a.currentTime = a.currentTime; } catch {}
          }
          if (wasPlayingRef.current && a.src && a.paused) {
            a.play().catch(() => {});
          }
        });
        appResumeRemove = () => { try { handle.remove?.(); } catch {} };
      } catch {}
    })();

    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (appResumeRemove) appResumeRemove();
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      audio.pause();
      audio.src = '';
      nextAudio.pause();
      nextAudio.src = '';
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
      }
      if (animationFrameRef.current) {
        window.clearInterval(animationFrameRef.current);
      }
    };
  }, []);

  // Update volume on audio element
  useEffect(() => {
    if (audioRef.current && !isCrossfading.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const preloadedNextIdRef = useRef<string | null>(null);

  // Wire the global EQ/audio engine to the live audio element. Persists across modal open/close.
  useGlobalAudioEngine(audioElement);


  // Progress is pushed via the audio element's native `timeupdate` event
  // (handled in the main audio listener below). No React state interval needed.

  // Get next song index - supports shuffle properly by tracking played songs
  const shuffleHistoryRef = useRef<Set<number>>(new Set());
  
  const getNextIndex = useCallback((currentIdx: number, queueLength: number, isShuffle: boolean, repeatMode: 'off' | 'all' | 'one'): number | null => {
    if (queueLength === 0) return null;
    
    if (isShuffle) {
      // Smart shuffle: avoid repeating until all songs played
      if (shuffleHistoryRef.current.size >= queueLength) {
        shuffleHistoryRef.current.clear();
      }
      shuffleHistoryRef.current.add(currentIdx);
      
      const available = Array.from({ length: queueLength }, (_, i) => i)
        .filter(i => !shuffleHistoryRef.current.has(i));
      
      if (available.length === 0) {
        // All played, start fresh
        shuffleHistoryRef.current.clear();
        return Math.floor(Math.random() * queueLength);
      }
      
      return available[Math.floor(Math.random() * available.length)];
    }
    
    const nextIdx = (currentIdx + 1) % queueLength;
    if (nextIdx === 0 && repeatMode === 'off') {
      return null; // End of queue
    }
    return nextIdx;
  }, []);

  // Helper to check if a URL is actually playable (not empty/placeholder)
  const isPlayableUrl = useCallback((url?: string) => {
    if (!url) return false;
    if (url === '' || url === 'pending' || url === 'resolving') return false;
    return url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:');
  }, []);

  // Resolve audio URL for indexed/stream tracks that have no real URL
  const resolveAudioUrl = useCallback(async (song: Song): Promise<string | null> => {
    if (isPlayableUrl(song.audio_url)) return song.audio_url;
    // Try to resolve via music indexer
    try {
      const result = await resolveIndexedTrack(song.artist, song.title);
      if (result?.streamUrl) return result.streamUrl;
    } catch { /* fall through */ }
    return null;
  }, [isPlayableUrl]);

  // ── Preload NEXT queued track for zero-gap transitions ──
  // Whenever queue / current index changes, warm `nextAudioRef` with the upcoming
  // song so crossfade & "next" feel instantaneous.
  useEffect(() => {
    if (!nextAudioRef.current || queue.length <= 1) {
      preloadedNextIdRef.current = null;
      return;
    }
    if (isCrossfading.current) return;

    const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
    if (nextIdx === null) {
      preloadedNextIdRef.current = null;
      return;
    }
    const upcoming = queue[nextIdx];
    if (!upcoming) return;
    if (preloadedNextIdRef.current === upcoming.id) return;

    if (isPlayableUrl(upcoming.audio_url) && !isYouTubeFallbackUrl(upcoming.audio_url)) {
      try {
        configureAudioElementSource(nextAudioRef.current, buildStreamProxyUrl(upcoming.audio_url));
        nextAudioRef.current.preload = 'auto';
        nextAudioRef.current.volume = 0;
        nextAudioRef.current.load();
        preloadedNextIdRef.current = upcoming.id;
      } catch { /* ignore preload errors */ }
    } else if (upcoming.source === 'indexed' || upcoming.audio_url === 'resolving') {
      prefetchIndexedTrack(upcoming.artist, upcoming.title);
      preloadedNextIdRef.current = upcoming.id;
    }
  }, [queue, currentIndex, shuffle, repeat, getNextIndex, isPlayableUrl]);

  // ── YouTube IFrame fallback helpers ──
  const stopYouTubeProgressLoop = useCallback(() => {
    if (youtubeProgressRef.current) {
      window.clearInterval(youtubeProgressRef.current);
      youtubeProgressRef.current = null;
    }
  }, []);

  const startYouTubeProgressLoop = useCallback(() => {
    stopYouTubeProgressLoop();
    youtubeProgressRef.current = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player || !youtubeActiveRef.current) return;
      try {
        setProgress(player.getCurrentTime() || 0);
        const dur = player.getDuration?.();
        if (dur && Number.isFinite(dur) && dur > 0) setDuration(dur);
      } catch { /* ignore */ }
    }, 500);
  }, [stopYouTubeProgressLoop]);

  const teardownYouTubePlayback = useCallback(() => {
    stopYouTubeProgressLoop();
    youtubeActiveRef.current = false;
    youtubeEndCallbackRef.current = null;
    try { youtubePlayerRef.current?.pauseVideo?.(); } catch { /* ignore */ }
  }, [stopYouTubeProgressLoop]);

  const ensureYouTubeContainer = useCallback(() => {
    let host = document.getElementById('uf-yt-fallback-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'uf-yt-fallback-host';
      host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(host);
    }
    let mount = document.getElementById('uf-yt-fallback-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'uf-yt-fallback-mount';
      host.appendChild(mount);
    }
    return mount;
  }, []);

  const playYouTubeFallback = useCallback(async (videoId: string, onEnded: () => void) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }

      const YT = await loadYouTubeIframeApi();
      if (!YT) throw new Error('YouTube API unavailable');

      youtubeActiveRef.current = true;
      youtubeEndCallbackRef.current = onEnded;

      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.loadVideoById(videoId);
          youtubePlayerRef.current.setVolume?.(Math.round(volume * 100));
          startYouTubeProgressLoop();
          setIsPlaying(true);
          return;
        } catch { /* recreate below */ }
      }

      const mount = ensureYouTubeContainer();
      mount.innerHTML = '';
      const playerEl = document.createElement('div');
      playerEl.id = `uf-yt-player-${Date.now()}`;
      mount.appendChild(playerEl);

      youtubePlayerRef.current = new YT.Player(playerEl.id, {
        height: '1',
        width: '1',
        videoId,
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: { target: YouTubePlayer }) => {
            try {
              e.target.setVolume?.(Math.round(volume * 100));
              e.target.playVideo();
              const dur = e.target.getDuration?.();
              if (dur && Number.isFinite(dur)) setDuration(dur);
            } catch { /* ignore */ }
            startYouTubeProgressLoop();
            setIsPlaying(true);
          },
          onStateChange: (e: { data: number }) => {
            const states = YT.PlayerState;
            if (e.data === states.PLAYING) setIsPlaying(true);
            else if (e.data === states.PAUSED) setIsPlaying(false);
            else if (e.data === states.ENDED) {
              setIsPlaying(false);
              youtubeEndCallbackRef.current?.();
            }
          },
          onError: () => {
            toast.error('Video source unavailable — skipping');
            youtubeEndCallbackRef.current?.();
          },
        },
      } as Record<string, unknown>);
    } catch (err) {
      console.warn('YouTube fallback failed:', err);
      youtubeActiveRef.current = false;
      setIsPlaying(false);
      toast.error('Could not load this track from any source.');
    }
  }, [ensureYouTubeContainer, startYouTubeProgressLoop, volume]);

  // Play a song at specific index - with lazy URL resolution
  const playSongAtIndex = useCallback(async (index: number, songQueue: Song[]) => {
    const song = songQueue[index];
    if (!song || !audioRef.current) return;

    if (!isPlayableUrl(song.audio_url)) {
      try {
        const resolved = await resolveAudioUrl(song);
        if (!resolved) {
          toast.error('This song is still preparing. Try again in a second.');
          setIsPlaying(false);
          return;
        }

        songQueue[index] = { ...song, audio_url: resolved };
      } catch {
        setIsPlaying(false);
        toast.error('This song could not be prepared for playback.');
        return;
      }
    }

    // Cancel any ongoing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;
    
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    // Update state first for instant UI response
    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setIsPlaying(true);

    // Resolve audio URL if needed
    let audioUrl = song.audio_url;
    if (!isPlayableUrl(audioUrl)) {
      try {
        const resolved = await resolveAudioUrl(song);
        if (resolved) {
          audioUrl = resolved;
          // Update the song in queue with resolved URL
          const updatedSong = { ...song, audio_url: resolved };
          setCurrentSong(updatedSong);
          songQueue[index] = updatedSong;
          setQueueState([...songQueue]);
        } else {
          console.warn('Could not resolve audio for:', song.title);
          setIsPlaying(false);
          return;
        }
      } catch {
        setIsPlaying(false);
        return;
      }
    }

    // ── YouTube IFrame fallback path ──
    if (isYouTubeFallbackUrl(audioUrl)) {
      const videoId = getYouTubeFallbackVideoId(audioUrl);
      if (!videoId) {
        setIsPlaying(false);
        toast.error('This song could not be played.');
        return;
      }
      await playYouTubeFallback(videoId, () => {
        // Trigger normal "ended" pipeline
        const evt = new Event('ended');
        try { audioRef.current?.dispatchEvent(evt); } catch { /* ignore */ }
      });
      return;
    }

    // Standard HTMLAudio path — make sure YT is torn down
    teardownYouTubePlayback();

    // Set source and play immediately
    configureAudioElementSource(audioRef.current, buildStreamProxyUrl(audioUrl));
    audioRef.current.volume = volume;
    audioRef.current.currentTime = 0;
    
    audioRef.current.load();
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.warn('Playback failed:', err.message);
        setIsPlaying(false);
      });
    }
    
    // Preload next song for gapless playback
    const nextIdx = (index + 1) % songQueue.length;
    if (nextIdx !== index && nextAudioRef.current) {
      const nextSong = songQueue[nextIdx];
      if (nextSong && isPlayableUrl(nextSong.audio_url) && !isYouTubeFallbackUrl(nextSong.audio_url)) {
        configureAudioElementSource(nextAudioRef.current, buildStreamProxyUrl(nextSong.audio_url));
        nextAudioRef.current.preload = 'auto';
        nextAudioRef.current.load();
      } else if (nextSong && (nextSong.source === 'indexed' || nextSong.audio_url === 'resolving')) {
        // Warm the stream cache for the next track so when user hits "next"
        // it resolves instantly from cache instead of waiting for the edge function.
        prefetchIndexedTrack(nextSong.artist, nextSong.title);
      }
    }
  }, [volume, isPlayableUrl, resolveAudioUrl, playYouTubeFallback, teardownYouTubePlayback]);

  // Handle song end and crossfade
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.warn);
        return;
      }

      // Move to next song immediately - no async operations
      let nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
      
      // If repeat is 'all' and we hit the end, loop back
      if (nextIdx === null && repeat === 'all') {
        nextIdx = 0;
      }
      
      if (nextIdx !== null && queue.length > 0) {
        const nextSong = queue[nextIdx];
        
        // Play next song immediately without any async delay
        playSongAtIndex(nextIdx, queue);
      } else if (repeat === 'off' && queue.length > 0) {
        // Stop at end of queue when repeat is off
        setIsPlaying(false);
        setProgress(0);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      if (!isCrossfading.current) {
        setIsPlaying(false);
      }
    };

    const handleTimeUpdate = () => {
      // Push progress to the external store (no React rerender of consumers
      // that don't use usePlayerProgress()).
      if (!isCrossfading.current) {
        playerProgressStore.setProgress(audio.currentTime);
      }
      // Crossfade logic
      if (crossfade && isPremiumUser && !isEqProcessingEnabled() && queue.length > 1 && audio.duration && !isCrossfading.current) {
        const timeLeft = audio.duration - audio.currentTime;
        if (timeLeft <= crossfadeDuration && timeLeft > 0) {
          startCrossfade();
        }
      }
    };

    // ── Auto-skip on stream errors (broken/expired URLs) ──
    let lastErrorAt = 0;
    const handleAudioError = () => {
      // Debounce: avoid skip-storms if a few errors fire in a row
      const now = Date.now();
      if (now - lastErrorAt < 1500) return;
      lastErrorAt = now;

      const errorCode = audio.error?.code;
      // Ignore aborts triggered by intentional source swaps / pauses
      if (errorCode === MediaError.MEDIA_ERR_ABORTED) return;

      console.warn('[player] audio error, auto-skipping:', errorCode, audio.error?.message);

      if (queue.length === 0) {
        setIsPlaying(false);
        return;
      }

      let nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
      if (nextIdx === null && repeat === 'all') nextIdx = 0;
      if (nextIdx === null && queue.length > 1) nextIdx = (currentIndex + 1) % queue.length;

      if (nextIdx !== null && nextIdx !== currentIndex) {
        toast.info('Stream unavailable — playing next song');
        playSongAtIndex(nextIdx, queue);
      } else {
        setIsPlaying(false);
        toast.error('This song could not start right now.');
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleAudioError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleAudioError);
    };
  }, [currentIndex, queue, shuffle, repeat, crossfade, crossfadeDuration, getNextIndex, playSongAtIndex]);

  // Crossfade implementation
  const startCrossfade = useCallback(() => {
    if (!audioRef.current || !nextAudioRef.current || isCrossfading.current) return;
    if (queue.length <= 1) return;
    if (isEqProcessingEnabled()) return;

    const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
    if (nextIdx === null) return;

    const nextSong = queue[nextIdx];
    if (!nextSong) return;

    isCrossfading.current = true;

    // Prepare next audio
    if (!isPlayableUrl(nextSong.audio_url)) {
      isCrossfading.current = false;
      return;
    }

    configureAudioElementSource(nextAudioRef.current, buildStreamProxyUrl(nextSong.audio_url));
    nextAudioRef.current.volume = 0;
    nextAudioRef.current.currentTime = 0;
    
    nextAudioRef.current.play().catch(() => {
      isCrossfading.current = false;
      return;
    });

    const steps = 30;
    const stepDuration = (crossfadeDuration * 1000) / steps;
    let currentStep = 0;

    crossfadeIntervalRef.current = window.setInterval(() => {
      currentStep++;
      const fadeProgress = currentStep / steps;

      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, volume * (1 - fadeProgress));
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.volume = Math.min(volume, volume * fadeProgress);
      }

      if (currentStep >= steps) {
        if (crossfadeIntervalRef.current) {
          clearInterval(crossfadeIntervalRef.current);
          crossfadeIntervalRef.current = null;
        }

        // Stop old audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        // Swap audio references
        const temp = audioRef.current;
        audioRef.current = nextAudioRef.current;
        nextAudioRef.current = temp;
        setAudioElement(audioRef.current);

        // Update state
        setCurrentSong(nextSong);
        setCurrentIndex(nextIdx);
        setProgress(0);
        setDuration(audioRef.current?.duration || 0);

        isCrossfading.current = false;
      }
    }, stepDuration);
  }, [queue, currentIndex, shuffle, repeat, crossfadeDuration, volume, getNextIndex]);

  const playActualSong = useCallback(async (song: Song, offlineUrl?: string | null, songsQueue?: Song[]) => {
    if (!audioRef.current) return;

    // Cancel any ongoing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

    // Update state immediately to prevent UI flicker
    setCurrentSong(song);
    setProgress(0);
    setIsPlaying(true);
    
    let playbackSource = offlineUrl || song.audio_url;

    if (!offlineUrl && !isPlayableUrl(playbackSource)) {
      const resolved = await resolveAudioUrl(song);
      if (!resolved) {
        setIsPlaying(false);
        toast.error('This song could not start right now.');
        return;
      }

      playbackSource = resolved;
      song = { ...song, audio_url: resolved };
      setCurrentSong(song);
    }

    const normalizedQueue = songsQueue?.map((queuedSong) =>
      queuedSong.id === song.id ? { ...queuedSong, audio_url: playbackSource } : queuedSong,
    );

    // ── YouTube IFrame fallback path ──
    if (!offlineUrl && isYouTubeFallbackUrl(playbackSource)) {
      const videoId = getYouTubeFallbackVideoId(playbackSource);
      if (videoId) {
        await playYouTubeFallback(videoId, () => {
          try { audioRef.current?.dispatchEvent(new Event('ended')); } catch { /* ignore */ }
        });
      } else {
        setIsPlaying(false);
        toast.error('This song could not start right now.');
      }
    } else {
      teardownYouTubePlayback();

      // Set audio source - use offline URL if available
      const playbackUrl = offlineUrl || buildStreamProxyUrl(playbackSource);
      configureAudioElementSource(audioRef.current, playbackUrl);
      audioRef.current.volume = volume;
      audioRef.current.currentTime = 0;

      // Load and play immediately
      audioRef.current.load();
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.catch(err => {
          console.warn('Playback failed:', err?.message);
          setIsPlaying(false);
          toast.error('This song could not start — trying another source helps while the stream refreshes.');
        });
      }
    }

    // If a queue is provided, use it
    if (normalizedQueue && normalizedQueue.length > 0) {
      setQueueState(normalizedQueue);
      const songIndex = normalizedQueue.findIndex(s => s.id === song.id);
      setCurrentIndex(songIndex >= 0 ? songIndex : 0);
    } else {
      // Update queue - add song if not exists
      const existingIndex = queue.findIndex(s => s.id === song.id);
      if (existingIndex === -1) {
        setQueueState(prev => [...prev, song]);
        setCurrentIndex(queue.length);
      } else {
        setCurrentIndex(existingIndex);
      }
    }

    // Track recently played — DEBOUNCED: only log if user actually listens
    // for 30s. Cancels previous pending log if user skips quickly.
    // Also: only catalog UUIDs are valid for recently_played.song_id (uuid column).
    if (recentlyPlayedTimerRef.current) {
      clearTimeout(recentlyPlayedTimerRef.current);
      recentlyPlayedTimerRef.current = null;
    }
    const isCatalogUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(song.id);
    if (isCatalogUuid) {
      const songIdToLog = song.id;
      recentlyPlayedTimerRef.current = window.setTimeout(() => {
        recentlyPlayedTimerRef.current = null;
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase.from('recently_played').insert({
              user_id: user.id,
              song_id: songIdToLog,
            }).then(() => {});
          }
        }).catch(() => {});
      }, 30000);
    }
  }, [isPlayableUrl, queue, resolveAudioUrl, volume, playYouTubeFallback, teardownYouTubePlayback]);

  // Check premium status from database
  const checkPremiumStatus = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsPremiumUser(false);
        return false;
      }

      const { data } = await supabase
        .from('user_subscriptions')
        .select('subscription_type, status, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
        const isPremium = data.subscription_type !== 'free' && data.status === 'active' && !isExpired;
        setIsPremiumUser(isPremium);
        return isPremium;
      }
      setIsPremiumUser(false);
      return false;
    } catch {
      setIsPremiumUser(false);
      return false;
    }
  }, []);

  const playSong = useCallback((song: Song, offlineUrl?: string | null, songsQueue?: Song[]) => {
    // Spotify-like behavior: a tap must start playback immediately. Ads/premium
    // checks must never block the audio pipeline.
    playActualSong(song, offlineUrl, songsQueue);
  }, [playActualSong]);

  const onPrerollAdComplete = useCallback(() => {
    setShowPrerollAd(false);
    if (pendingSong) {
      playActualSong(pendingSong.song, pendingSong.offlineUrl, pendingSong.songsQueue);
      setPendingSong(null);
    }
  }, [pendingSong, playActualSong]);

  const togglePlay = useCallback(() => {
    if (!currentSong) return;

    if (youtubeActiveRef.current && youtubePlayerRef.current) {
      try {
        if (isPlaying) { youtubePlayerRef.current.pauseVideo(); setIsPlaying(false); }
        else { youtubePlayerRef.current.playVideo(); setIsPlaying(true); }
      } catch { /* ignore */ }
      return;
    }

    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(err => console.warn('Play failed:', err.message));
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentSong, isPlaying]);

  const pause = useCallback(() => {
    if (youtubeActiveRef.current && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.pauseVideo(); } catch { /* ignore */ }
      setIsPlaying(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(() => {
    if (!currentSong) return;
    if (youtubeActiveRef.current && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.playVideo(); } catch { /* ignore */ }
      setIsPlaying(true);
      return;
    }
    if (audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
    }
  }, [currentSong]);

  const stopSong = useCallback(() => {
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

    teardownYouTubePlayback();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    setCurrentSong(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setQueueState([]);
    setCurrentIndex(0);
    setExpanded(false);
  }, [teardownYouTubePlayback]);

  const nextSong = useCallback(() => {
    if (queue.length === 0) return;

    // Cancel crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
    if (nextIdx !== null) {
      playSongAtIndex(nextIdx, queue);
    } else {
      // Loop back to start even if repeat is off when manually pressing next
      playSongAtIndex(0, queue);
    }
  }, [queue, currentIndex, shuffle, repeat, getNextIndex, playSongAtIndex]);

  const prevSong = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;

    // Cancel crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    // If more than 3 seconds in, restart current song
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setProgress(0);
    } else {
      // Go to previous song
      const prevIdx = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
      playSongAtIndex(prevIdx, queue);
    }
  }, [queue, currentIndex, playSongAtIndex]);

  const seek = useCallback((time: number) => {
    if (youtubeActiveRef.current && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.seekTo(time, true); } catch { /* ignore */ }
      setProgress(time);
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

  // Sync volume to YT player when it changes
  useEffect(() => {
    if (youtubeActiveRef.current && youtubePlayerRef.current) {
      try { youtubePlayerRef.current.setVolume?.(Math.round(volume * 100)); } catch { /* ignore */ }
    }
  }, [volume]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
  }, []);

  const setQueue = useCallback((songs: Song[]) => {
    setQueueState(songs);
    setCurrentIndex(0);
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setQueueState(prev => [...prev, song]);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const newVal = !prev;
      // Clear shuffle history when toggling
      if (newVal) {
        shuffleHistoryRef.current.clear();
      }
      return newVal;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat(prev => {
      const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
      const idx = modes.indexOf(prev);
      const newMode = modes[(idx + 1) % modes.length];
      return newMode;
    });
  }, []);

  const toggleCrossfade = useCallback(() => {
    setCrossfade(prev => !prev);
  }, []);

  const setCrossfadeDurationFn = useCallback((seconds: number) => {
    setCrossfadeDurationState(Math.max(1, Math.min(12, seconds)));
  }, []);

  // Media Session API for lock screen / notification controls
  // These callbacks must be stable refs to avoid hook count issues
  const mediaSessionCallbacks = React.useMemo(() => ({
    onPlay: () => {
      if (audioRef.current && currentSong) {
        audioRef.current.play().catch(console.warn);
      }
    },
    onPause: () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    },
    onNext: () => {
      if (queue.length === 0) return;
      const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
      if (nextIdx !== null) {
        playSongAtIndex(nextIdx, queue);
      } else {
        playSongAtIndex(0, queue);
      }
    },
    onPrev: () => {
      if (!audioRef.current || queue.length === 0) return;
      if (audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
        setProgress(0);
      } else {
        const prevIdx = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
        playSongAtIndex(prevIdx, queue);
      }
    },
    onSeek: (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setProgress(time);
      }
    },
  }), [currentSong, queue, currentIndex, shuffle, repeat, getNextIndex, playSongAtIndex]);

  const { progress: liveProgress, duration: liveDuration } = usePlayerProgress();

  useMediaSession({
    song: currentSong,
    isPlaying,
    onPlay: mediaSessionCallbacks.onPlay,
    onPause: mediaSessionCallbacks.onPause,
    onNext: mediaSessionCallbacks.onNext,
    onPrev: mediaSessionCallbacks.onPrev,
    onSeek: mediaSessionCallbacks.onSeek,
    duration: liveDuration,
    progress: liveProgress,
  });

  // Native Android music controls (lockscreen + notification on APK).
  // No-op on web — useMediaSession handles browser/PWA controls.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { setNativeMusicHandlers, showNativeMusicControls, destroyNativeMusicControls } =
        await import('@/lib/nativeMusicControls');
      if (cancelled) return;

      setNativeMusicHandlers({
        onPlay: () => mediaSessionCallbacks.onPlay(),
        onPause: () => mediaSessionCallbacks.onPause(),
        onNext: () => mediaSessionCallbacks.onNext(),
        onPrev: () => mediaSessionCallbacks.onPrev(),
        onStop: () => mediaSessionCallbacks.onPause(),
      });

      if (currentSong) {
        await showNativeMusicControls(
          {
            title: currentSong.title,
            artist: currentSong.artist,
            cover: currentSong.cover_url,
            album: currentSong.album,
            duration: liveDuration || currentSong.duration,
          },
          isPlaying,
        );
      } else {
        await destroyNativeMusicControls();
      }
    })();
    return () => { cancelled = true; };
  }, [currentSong?.id, isPlaying, liveDuration, mediaSessionCallbacks]);

  // Track each played song into local song-history (Spotify-style search history)
  useEffect(() => {
    if (!currentSong) return;
    import('@/lib/songHistory').then(({ addSongToHistory }) => addSongToHistory(currentSong));
  }, [currentSong?.id]);

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      volume,
      queue,
      shuffle,
      repeat,
      isExpanded,
      crossfade,
      crossfadeDuration,
      audioElement,
      showPrerollAd,
      adType,
      playSong,
      togglePlay,
      pause,
      play,
      stopSong,
      nextSong,
      prevSong,
      seek,
      setVolume,
      setQueue,
      addToQueue,
      toggleShuffle,
      toggleRepeat,
      setExpanded,
      toggleCrossfade,
      setCrossfadeDuration: setCrossfadeDurationFn,
      onPrerollAdComplete,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
