import { useEffect, useState } from 'react';
import { bypassAudioElement, connectAudioElement, setBands, setReverb, setSpatial, setLateNight, resume, subscribe } from '@/lib/audioEngine';
import { usePremium } from '@/hooks/usePremium';

const STORAGE_KEY = 'eq_settings';

interface StoredEQ {
  bands?: number[];
  bassBoost?: number;
  reverb?: number;
  spatialAudio?: boolean;
  playbackSpeed?: number;
  lateNight?: boolean;
}

function readStored(): StoredEQ {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function hasActiveProcessing(s: StoredEQ) {
  return Boolean(
    s.bands?.some((gain) => Math.abs(gain) >= 0.5) ||
    (s.bassBoost ?? 0) > 0 ||
    (s.reverb ?? 0) > 0 ||
    s.spatialAudio ||
    s.lateNight ||
    (typeof s.playbackSpeed === 'number' && s.playbackSpeed !== 1)
  );
}

/**
 * Mount once at app root. Connects the engine to the live <audio> element
 * and re-applies persisted EQ settings whenever the source changes.
 */
export function useGlobalAudioEngine(audioElement: HTMLAudioElement | null) {
  const { isPremium, isLoading } = usePremium();

  useEffect(() => {
    if (!audioElement) return;

    // NOTE: premium status flows through the runtime flag in
    // src/lib/premiumState.ts (set by usePremium after a server fetch).
    // We intentionally no longer write `uf_audio_fx_allowed` to
    // localStorage — that key was trivially editable from DevTools.

    // Track whether processed chain is "wanted" so we can switch to direct
    // when backgrounded (to avoid Android throttling glitches) and restore
    // when foregrounded.
    let processedWanted = false;

    const reapply = () => {
      if (!isPremium) {
        bypassAudioElement(audioElement);
        audioElement.playbackRate = 1;
        processedWanted = false;
        return;
      }

      const s = readStored();
      if (!hasActiveProcessing(s)) {
        bypassAudioElement(audioElement);
        audioElement.playbackRate = 1;
        processedWanted = false;
        return;
      }

      processedWanted = true;

      // While backgrounded, keep the cheap direct path to avoid stutters.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        bypassAudioElement(audioElement);
        if (typeof s.playbackSpeed === 'number') audioElement.playbackRate = s.playbackSpeed;
        return;
      }

      const ok = connectAudioElement(audioElement);
      if (!ok) return;
      setBands(s.bands ?? [0, 0, 0, 0, 0, 0, 0, 0], s.bassBoost ?? 0);
      setReverb(s.reverb ?? 0);
      setSpatial(!!s.spatialAudio);
      setLateNight(!!s.lateNight);
      if (typeof s.playbackSpeed === 'number') audioElement.playbackRate = s.playbackSpeed;
    };

    // Resume the AudioContext on first user gesture / play
    const onPlay = () => resume();
    const onPointer = () => resume();

    // Background → bypass effects to prevent Android JS throttling glitches.
    // Foreground → restore the processed chain if the user had it on.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (processedWanted) {
          bypassAudioElement(audioElement);
        }
      } else {
        resume();
        reapply();
      }
    };

    if (!isLoading) reapply();
    audioElement.addEventListener('loadedmetadata', reapply);
    audioElement.addEventListener('canplay', reapply);
    audioElement.addEventListener('play', onPlay);
    document.addEventListener('pointerdown', onPointer, { once: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      audioElement.removeEventListener('loadedmetadata', reapply);
      audioElement.removeEventListener('canplay', reapply);
      audioElement.removeEventListener('play', onPlay);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [audioElement, isPremium, isLoading]);
}

export function useEngineState() {
  const [mode, setMode] = useState(() => 'idle' as ReturnType<typeof import('@/lib/audioEngine').getState>);
  useEffect(() => subscribe(setMode), []);
  return mode;
}
