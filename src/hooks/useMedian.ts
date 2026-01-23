import { useEffect, useState, useCallback } from 'react';
import { isMedianApp, isMedianIOS, isMedianAndroid, getMedian } from '@/lib/median';

type MedianType = Awaited<ReturnType<typeof getMedian>>;

export const useMedian = () => {
  const [isReady, setIsReady] = useState(false);
  const [median, setMedian] = useState<MedianType | null>(null);
  const platform = isMedianIOS ? 'ios' : isMedianAndroid ? 'android' : 'web';

  useEffect(() => {
    if (!isMedianApp) return;

    // Load Median SDK
    getMedian().then((Median) => {
      setMedian(Median);
      Median.onReady(() => {
        setIsReady(true);
      });
    });
  }, []);

  const getDeviceInfo = useCallback(async () => {
    if (!isMedianApp || !median) return null;
    try {
      return await median.deviceInfo();
    } catch (error) {
      console.error('Failed to get device info:', error);
      return null;
    }
  }, [median]);

  const share = useCallback(async (url: string, text?: string) => {
    if (!isMedianApp || !median) {
      // Fallback to web share API
      if (navigator.share) {
        await navigator.share({ url, text });
      }
      return;
    }
    try {
      median.share.sharePage({ url, text });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [median]);

  const setStatusBarStyle = useCallback((style: 'light' | 'dark' | 'auto', color?: string) => {
    if (!isMedianApp || !median) return;
    try {
      median.statusbar.set({ 
        style, 
        color: color || '#000000',
        overlay: false,
        blur: false
      });
    } catch (error) {
      console.error('Failed to set status bar style:', error);
    }
  }, [median]);

  const hapticFeedback = useCallback((type: 'impactLight' | 'impactMedium' | 'impactHeavy' = 'impactMedium') => {
    if (!isMedianApp || !median) return;
    try {
      median.haptics.trigger({ style: type });
    } catch (error) {
      console.error('Failed to trigger haptic feedback:', error);
    }
  }, [median]);

  return {
    isReady,
    isNativeApp: isMedianApp,
    platform,
    Median: median,
    getDeviceInfo,
    share,
    setStatusBarStyle,
    hapticFeedback,
  };
};

export default useMedian;
