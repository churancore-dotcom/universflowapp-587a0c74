import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useMediaSession } from '@/hooks/useMediaSession';
import { supabase } from '@/integrations/supabase/client';

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
}

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
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

const CORS_ENABLED_AUDIO_HOSTS = ['supabase.co', 'the-standard.io'];

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

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
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

    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      audio.pause();
      audio.src = '';
      nextAudio.pause();
      nextAudio.src = '';
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update volume on audio element
  useEffect(() => {
    if (audioRef.current && !isCrossfading.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Progress update loop using requestAnimationFrame for smooth updates
  useEffect(() => {
    const updateProgress = () => {
      if (audioRef.current && !audioRef.current.paused && !isCrossfading.current) {
        setProgress(audioRef.current.currentTime);
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

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

  // Play a song at specific index - synchronous for gapless playback
  const playSongAtIndex = useCallback((index: number, songQueue: Song[]) => {
    const song = songQueue[index];
    if (!song || !audioRef.current) return;

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

    // Update state first
    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setIsPlaying(true); // Set playing immediately to prevent UI flicker
    
    // Set source and play immediately
    configureAudioElementSource(audioRef.current, song.audio_url);
    audioRef.current.volume = volume;
    audioRef.current.currentTime = 0;
    
    // Use load() + play() for faster start
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
      if (nextSong) {
        configureAudioElementSource(nextAudioRef.current, nextSong.audio_url);
        nextAudioRef.current.preload = 'auto';
        nextAudioRef.current.load();
      }
    }
  }, [volume]);

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
        
        // Check premium and show end-of-song ad for non-premium
        if (!isPremiumUser && songsPlayedSinceAd >= AD_FREQUENCY - 1) {
          setPendingSong({ song: nextSong, offlineUrl: null, songsQueue: queue });
          setAdType('end');
          setShowPrerollAd(true);
          setSongsPlayedSinceAd(0);
          return;
        }
        
        setSongsPlayedSinceAd(prev => prev + 1);
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
      // Crossfade logic
      if (crossfade && !isEqProcessingEnabled() && queue.length > 1 && audio.duration && !isCrossfading.current) {
        const timeLeft = audio.duration - audio.currentTime;
        if (timeLeft <= crossfadeDuration && timeLeft > 0) {
          startCrossfade();
        }
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentIndex, queue, shuffle, repeat, crossfade, crossfadeDuration, getNextIndex, playSongAtIndex, isPremiumUser, songsPlayedSinceAd]);

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
    configureAudioElementSource(nextAudioRef.current, nextSong.audio_url);
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

  const playActualSong = useCallback((song: Song, offlineUrl?: string | null, songsQueue?: Song[]) => {
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
    
    // Set audio source - use offline URL if available
    configureAudioElementSource(audioRef.current, offlineUrl || song.audio_url);
    audioRef.current.volume = volume;
    audioRef.current.currentTime = 0;

    // Load and play immediately
    audioRef.current.load();
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.warn('Playback failed:', err?.message);
        setIsPlaying(false);
      });
    }

    // If a queue is provided, use it
    if (songsQueue && songsQueue.length > 0) {
      setQueueState(songsQueue);
      const songIndex = songsQueue.findIndex(s => s.id === song.id);
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

    // Track recently played (fire and forget - no await)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('recently_played').insert({
          user_id: user.id,
          song_id: song.id,
        }).then(() => {});
      }
    }).catch(() => {});
  }, [volume, queue]);

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
    // Use cached premium status - don't await async call which causes pause
    // Only show ads to non-premium users
    if (!isPremiumUser) {
      const shouldShowAd = songsPlayedSinceAd >= AD_FREQUENCY - 1;
      
      if (shouldShowAd) {
        // Store pending song and show ad
        setPendingSong({ song, offlineUrl, songsQueue });
        setAdType('start');
        setShowPrerollAd(true);
        setSongsPlayedSinceAd(0);
        return;
      }
    }
    
    // Play directly (premium or not ad time yet)
    setSongsPlayedSinceAd(prev => prev + 1);
    playActualSong(song, offlineUrl, songsQueue);
  }, [songsPlayedSinceAd, playActualSong, isPremiumUser]);

  const onPrerollAdComplete = useCallback(() => {
    setShowPrerollAd(false);
    if (pendingSong) {
      playActualSong(pendingSong.song, pendingSong.offlineUrl, pendingSong.songsQueue);
      setPendingSong(null);
    }
  }, [pendingSong, playActualSong]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentSong) return;

    if (audioRef.current.paused) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Play failed:', err.message);
      });
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentSong]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(console.warn);
    }
  }, [currentSong]);

  const stopSong = useCallback(() => {
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

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
  }, []);

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
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

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

  useMediaSession({
    song: currentSong,
    isPlaying,
    onPlay: mediaSessionCallbacks.onPlay,
    onPause: mediaSessionCallbacks.onPause,
    onNext: mediaSessionCallbacks.onNext,
    onPrev: mediaSessionCallbacks.onPrev,
    onSeek: mediaSessionCallbacks.onSeek,
    duration,
    progress,
  });

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      progress,
      duration,
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
