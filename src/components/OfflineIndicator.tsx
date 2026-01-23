import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, Download } from 'lucide-react';
import { useDownloads } from '@/contexts/DownloadContext';
import { iosSpring } from '@/lib/animations';

const OfflineIndicator = memo(() => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const { downloads } = useDownloads();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="fixed top-0 inset-x-0 z-[300] flex justify-center safe-area-pt"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={iosSpring}
        >
          <motion.div
            className={`mx-4 mt-4 px-5 py-3 rounded-2xl flex items-center gap-3 ${
              isOnline
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-orange-500/20 border border-orange-500/30'
            }`}
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            {isOnline ? (
              <>
                <Wifi className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">Back online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-orange-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-orange-400">You're offline</span>
                  {downloads.length > 0 && (
                    <span className="text-xs text-orange-400/70 flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {downloads.length} songs available offline
                    </span>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export default OfflineIndicator;
