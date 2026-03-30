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
  const [crossfade, setCrossfade] = useState(true);
  const [crossfadeDuration, setCrossfadeDurationState] = useState(3);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showPrerollAd, setShowPrerollAd] = useState(false);
  const [adType, setAdType] = useState<'start' | 'end'>('start');
  const [pendingSong, setPendingSong] = useState<{ song: Song; offlineUrl?: string | null; songsQueue?: Song[] } | null>(null);
  const [songsPlayedSinceAd, setSongsPlayedSinceAd] = useState(0);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const AD_FREQUENCY = 3;
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeIntervalRef = useRef<number | null>(null);
  const isCrossfading = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  // Track if we were playing before going to background
  const wasPlayingBeforeHidden = useRef(false);
  // Track retry attempts for failed audio
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

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

    // FIX: Proper background/foreground handling
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasPlayingBeforeHidden.current = !!(audioRef.current && !audioRef.current.paused);
      } else if (document.visibilityState === 'visible') {
        if (audioRef.current && audioRef.current.src) {
          // Re-sync state with actual audio element
          if (wasPlayingBeforeHidden.current && audioRef.current.paused) {
            audioRef.current.play().catch(() => setIsPlaying(false));
          }
          // Always update progress on return
          setProgress(audioRef.current.currentTime);
        }
      }
    };

    const handleFocus = () => {
      if (audioRef.current && audioRef.current.src) {
        // Resume audio that was interrupted
        if (wasPlayingBeforeHidden.current && audioRef.current.paused && audioRef.current.currentTime > 0) {
          audioRef.current.play().catch(() => setIsPlaying(false));
        }
      }
    };

    // Prevent audio suspension on mobile: periodically touch the audio context
    let keepAliveInterval: number | null = null;
    const startKeepAlive = () => {
      if (keepAliveInterval) return;
      keepAliveInterval = window.setInterval(() => {
        if (audioRef.current && !audioRef.current.paused && audioRef.current.readyState >= 2) {
          // Touch readyState to keep connection alive
          void audioRef.current.buffered;
        }
      }, 5000);
    };
    startKeepAlive();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
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

  // Progress update loop using requestAnimationFrame
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

  // Smart shuffle with history tracking
  const shuffleHistoryRef = useRef<Set<number>>(new Set());
  
  const getNextIndex = useCallback((currentIdx: number, queueLength: number, isShuffle: boolean, repeatMode: 'off' | 'all' | 'one'): number | null => {
    if (queueLength === 0) return null;
    
    if (isShuffle) {
      if (shuffleHistoryRef.current.size >= queueLength) {
        shuffleHistoryRef.current.clear();
      }
      shuffleHistoryRef.current.add(currentIdx);
      
      const available = Array.from({ length: queueLength }, (_, i) => i)
        .filter(i => !shuffleHistoryRef.current.has(i));
      
      if (available.length === 0) {
        shuffleHistoryRef.current.clear();
        return Math.floor(Math.random() * queueLength);
      }
      
      return available[Math.floor(Math.random() * available.length)];
    }
    
    const nextIdx = (currentIdx + 1) % queueLength;
    if (nextIdx === 0 && repeatMode === 'off') {
      return null;
    }
    return nextIdx;
  }, []);

  // Play a song at specific index
  const playSongAtIndex = useCallback((index: number, songQueue: Song[]) => {
    const song = songQueue[index];
    if (!song || !audioRef.current) return;

    // Cancel any ongoing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;
    retryCountRef.current = 0;
    
    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    setCurrentSong(song);
    setCurrentIndex(index);
    setProgress(0);
    setIsPlaying(true);
    wasPlayingBeforeHidden.current = true;
    
    audioRef.current.src = song.audio_url;
    audioRef.current.volume = volume;
    audioRef.current.currentTime = 0;
    
    audioRef.current.load();
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.warn('Playback failed:', err.message);
        setIsPlaying(false);
        wasPlayingBeforeHidden.current = false;
      });
    }
    
    // Preload next song
    const nextIdx = (index + 1) % songQueue.length;
    if (nextIdx !== index && nextAudioRef.current) {
      const nextSong = songQueue[nextIdx];
      if (nextSong) {
        nextAudioRef.current.src = nextSong.audio_url;
        nextAudioRef.current.preload = 'auto';
        nextAudioRef.current.load();
      }
    }
  }, [volume]);

  // Handle song end, errors, and stalls
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

      let nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
      
      if (nextIdx === null && repeat === 'all') {
        nextIdx = 0;
      }
      
      if (nextIdx !== null && queue.length > 0) {
        const nextSong = queue[nextIdx];
        
        if (!isPremiumUser && songsPlayedSinceAd >= AD_FREQUENCY - 1) {
          setPendingSong({ song: nextSong, offlineUrl: null, songsQueue: queue });
          setAdType('end');
          setShowPrerollAd(true);
          setSongsPlayedSinceAd(0);
          return;
        }
        
        setSongsPlayedSinceAd(prev => prev + 1);
        playSongAtIndex(nextIdx, queue);
      } else if (repeat === 'off' && queue.length > 0) {
        setIsPlaying(false);
        wasPlayingBeforeHidden.current = false;
        setProgress(0);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      wasPlayingBeforeHidden.current = true;
    };

    const handlePause = () => {
      if (!isCrossfading.current) {
        setIsPlaying(false);
      }
    };

    // FIX: Handle audio loading errors - auto-skip to next song
    const handleError = () => {
      console.warn('Audio error on:', audio.src?.substring(0, 80));
      
      if (retryCountRef.current < MAX_RETRIES) {
        // Retry loading the same song
        retryCountRef.current++;
        console.log(`Retrying playback (attempt ${retryCountRef.current})...`);
        setTimeout(() => {
          if (audio.src) {
            audio.load();
            audio.play().catch(() => {
              // If retry fails, skip to next
              if (queue.length > 1) {
                const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
                if (nextIdx !== null) {
                  playSongAtIndex(nextIdx, queue);
                }
              } else {
                setIsPlaying(false);
                wasPlayingBeforeHidden.current = false;
              }
            });
          }
        }, 1000);
      } else {
        // Max retries reached, skip to next song
        retryCountRef.current = 0;
        if (queue.length > 1) {
          const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
          if (nextIdx !== null) {
            console.log('Skipping broken track, moving to next...');
            playSongAtIndex(nextIdx, queue);
          }
        } else {
          setIsPlaying(false);
          wasPlayingBeforeHidden.current = false;
        }
      }
    };

    // FIX: Handle stalled/waiting - audio buffering issues
    const handleStalled = () => {
      console.warn('Audio stalled, attempting recovery...');
      if (audio.currentTime > 0) {
        const currentTime = audio.currentTime;
        setTimeout(() => {
          if (audio.readyState < 3) {
            audio.currentTime = currentTime;
            audio.play().catch(() => {});
          }
        }, 1500);
      }
    };

    // Handle 'waiting' event — browser is buffering
    const handleWaiting = () => {
      console.warn('Audio waiting/buffering...');
      setTimeout(() => {
        if (audio.readyState < 3 && !audio.paused) {
          // Try to nudge playback
          const ct = audio.currentTime;
          audio.currentTime = ct;
        }
      }, 3000);
    };

    const handleTimeUpdate = () => {
      if (crossfade && queue.length > 1 && audio.duration && !isCrossfading.current) {
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
    audio.addEventListener('error', handleError);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [currentIndex, queue, shuffle, repeat, crossfade, crossfadeDuration, getNextIndex, playSongAtIndex, isPremiumUser, songsPlayedSinceAd]);

  // Crossfade implementation
  const startCrossfade = useCallback(() => {
    if (!audioRef.current || !nextAudioRef.current || isCrossfading.current) return;
    if (queue.length <= 1) return;

    const nextIdx = getNextIndex(currentIndex, queue.length, shuffle, repeat);
    if (nextIdx === null) return;

    const nextSong = queue[nextIdx];
    if (!nextSong) return;

    isCrossfading.current = true;

    nextAudioRef.current.src = nextSong.audio_url;
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

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        // Swap audio references
        const temp = audioRef.current;
        audioRef.current = nextAudioRef.current;
        nextAudioRef.current = temp;
        setAudioElement(audioRef.current);

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
    retryCountRef.current = 0;

    setCurrentSong(song);
    setProgress(0);
    setIsPlaying(true);
    wasPlayingBeforeHidden.current = true;
    
    audioRef.current.src = offlineUrl || song.audio_url;
    audioRef.current.volume = volume;
    audioRef.current.currentTime = 0;

    audioRef.current.load();
    const playPromise = audioRef.current.play();
    if (playPromise) {
      playPromise.catch(err => {
        console.warn('Playback failed:', err?.message);
        setIsPlaying(false);
        wasPlayingBeforeHidden.current = false;
      });
    }

    if (songsQueue && songsQueue.length > 0) {
      setQueueState(songsQueue);
      const songIndex = songsQueue.findIndex(s => s.id === song.id);
      setCurrentIndex(songIndex >= 0 ? songIndex : 0);
    } else {
      const existingIndex = queue.findIndex(s => s.id === song.id);
      if (existingIndex === -1) {
        setQueueState(prev => [...prev, song]);
        setCurrentIndex(queue.length);
      } else {
        setCurrentIndex(existingIndex);
      }
    }

    // Track recently played (fire and forget)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('recently_played').insert({
          user_id: user.id,
          song_id: song.id,
        }).then(() => {});
      }
    }).catch(() => {});
  }, [volume, queue]);

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
    if (!isPremiumUser) {
      const shouldShowAd = songsPlayedSinceAd >= AD_FREQUENCY - 1;
      
      if (shouldShowAd) {
        setPendingSong({ song, offlineUrl, songsQueue });
        setAdType('start');
        setShowPrerollAd(true);
        setSongsPlayedSinceAd(0);
        return;
      }
    }
    
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
        wasPlayingBeforeHidden.current = true;
      }).catch(err => {
        console.warn('Play failed:', err.message);
      });
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
      wasPlayingBeforeHidden.current = false;
    }
  }, [currentSong]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      wasPlayingBeforeHidden.current = false;
    }
  }, []);

  const play = useCallback(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        wasPlayingBeforeHidden.current = true;
      }).catch(console.warn);
    }
  }, [currentSong]);

  const stopSong = useCallback(() => {
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;
    wasPlayingBeforeHidden.current = false;

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
      playSongAtIndex(0, queue);
    }
  }, [queue, currentIndex, shuffle, repeat, getNextIndex, playSongAtIndex]);

  const prevSong = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;

    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfading.current = false;

    if (nextAudioRef.current) {
      nextAudioRef.current.pause();
      nextAudioRef.current.src = '';
    }

    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setProgress(0);
    } else {
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
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  const toggleCrossfade = useCallback(() => {
    setCrossfade(prev => !prev);
  }, []);

  const setCrossfadeDurationFn = useCallback((seconds: number) => {
    setCrossfadeDurationState(Math.max(1, Math.min(12, seconds)));
  }, []);

  // Media Session API
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
