import { useCallback, useEffect, useState } from 'react';
import { isMedianApp, getMedian } from '@/lib/median';

type HapticStyle = 'impactLight' | 'impactMedium' | 'impactHeavy' | 'selection' | 'success' | 'warning' | 'error';

// Global haptics enabled state (can be toggled from settings)
let hapticsEnabled = true;

export const setHapticsEnabled = (enabled: boolean) => {
  hapticsEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('haptics_enabled', JSON.stringify(enabled));
  }
};

export const getHapticsEnabled = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('haptics_enabled');
    if (stored !== null) {
      hapticsEnabled = JSON.parse(stored);
    }
  }
  return hapticsEnabled;
};

// Initialize from storage
if (typeof window !== 'undefined') {
  getHapticsEnabled();
}

type MedianType = Awaited<ReturnType<typeof getMedian>>;

export const useHaptics = () => {
  const [median, setMedian] = useState<MedianType | null>(null);

  useEffect(() => {
    if (!isMedianApp) return;
    getMedian().then(setMedian);
  }, []);

  const trigger = useCallback((style: HapticStyle = 'impactLight') => {
    if (!hapticsEnabled) return;

    // Native haptics via Median
    if (isMedianApp && median) {
      try {
        // Map our style names to Median's expected styles
        const medianStyle = style === 'selection' || style === 'success' || style === 'warning' || style === 'error'
          ? 'impactLight'
          : style;
        median.haptics.trigger({ style: medianStyle });
        return;
      } catch (error) {
        console.warn('Median haptics failed:', error);
      }
    }

    // Web Vibration API fallback
    if ('vibrate' in navigator) {
      try {
        const patterns: Record<HapticStyle, number | number[]> = {
          impactLight: 10,
          impactMedium: 20,
          impactHeavy: 30,
          selection: 5,
          success: [10, 50, 10],
          warning: [20, 40, 20],
          error: [30, 50, 30, 50, 30],
        };
        navigator.vibrate(patterns[style]);
      } catch {
        // Vibration not supported or blocked
      }
    }
  }, [median]);

  const light = useCallback(() => trigger('impactLight'), [trigger]);
  const medium = useCallback(() => trigger('impactMedium'), [trigger]);
  const heavy = useCallback(() => trigger('impactHeavy'), [trigger]);
  const selection = useCallback(() => trigger('selection'), [trigger]);
  const success = useCallback(() => trigger('success'), [trigger]);
  const warning = useCallback(() => trigger('warning'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);

  return {
    trigger,
    light,
    medium,
    heavy,
    selection,
    success,
    warning,
    error,
    isEnabled: hapticsEnabled,
    setEnabled: setHapticsEnabled,
  };
};

// Standalone function for use outside of React components
export const triggerHaptic = (style: HapticStyle = 'impactLight') => {
  if (!hapticsEnabled) return;

  if (isMedianApp) {
    getMedian().then((Median) => {
      try {
        const medianStyle = style === 'selection' || style === 'success' || style === 'warning' || style === 'error'
          ? 'impactLight'
          : style;
        Median.haptics.trigger({ style: medianStyle });
      } catch {
        // Fallback to vibration
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
      }
    });
    return;
  }

  if ('vibrate' in navigator) {
    try {
      const patterns: Record<HapticStyle, number | number[]> = {
        impactLight: 10,
        impactMedium: 20,
        impactHeavy: 30,
        selection: 5,
        success: [10, 50, 10],
        warning: [20, 40, 20],
        error: [30, 50, 30, 50, 30],
      };
      navigator.vibrate(patterns[style]);
    } catch {
      // Vibration not supported
    }
  }
};

export default useHaptics;
