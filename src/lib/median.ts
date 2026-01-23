// Global detection for Median native app - no dependencies
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isMedianApp = userAgent.indexOf('MedianIOS') > -1 || userAgent.indexOf('MedianAndroid') > -1;
export const isMedianIOS = userAgent.indexOf('MedianIOS') > -1;
export const isMedianAndroid = userAgent.indexOf('MedianAndroid') > -1;

// Also expose on window for easy access
if (typeof window !== 'undefined') {
  (window as any).isMedianApp = isMedianApp;
  (window as any).isMedianIOS = isMedianIOS;
  (window as any).isMedianAndroid = isMedianAndroid;
}

// Lazy load Median SDK only when needed
export const getMedian = async () => {
  const { default: Median } = await import('median-js-bridge');
  return Median;
};