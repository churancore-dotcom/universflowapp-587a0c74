import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { iosSpring } from '@/lib/animations';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallBanner = memo(function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { trigger } = useHaptics();

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if dismissed recently (24 hours)
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS instructions after a delay
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    trigger('impactMedium');
    
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    trigger('impactLight');
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  // Don't show if already installed
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="fixed bottom-20 inset-x-0 z-[200] flex justify-center px-3 safe-area-pb"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={iosSpring}
        >
          <motion.div
            className="w-full max-w-[390px] bg-card/95 border border-border/50 rounded-2xl p-4 shadow-2xl"
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-start gap-3">
              {/* App Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6 text-primary-foreground" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Install Univers Flow
                </h3>
                {isIOS ? (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Tap <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-muted rounded text-xs font-medium">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 4.5H7a.5.5 0 01-.5-.5V3a.5.5 0 01.5-.5h6a.5.5 0 01.5.5v1a.5.5 0 01-.5.5z"/>
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v9.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V3a1 1 0 011-1z" clipRule="evenodd"/>
                      </svg>
                      Share
                    </span> then <span className="font-medium">"Add to Home Screen"</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Add to your home screen for the best experience
                  </p>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="p-1.5 -mr-1 -mt-1 rounded-full hover:bg-muted/50 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Install Button (Android/Chrome only) */}
            {!isIOS && deferredPrompt && (
              <motion.button
                onClick={handleInstall}
                className="mt-3 w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                whileTap={{ scale: 0.98 }}
              >
                <Download className="w-4 h-4" />
                Install App
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

PWAInstallBanner.displayName = 'PWAInstallBanner';

export default PWAInstallBanner;
