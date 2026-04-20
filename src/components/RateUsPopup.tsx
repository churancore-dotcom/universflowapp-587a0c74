import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { triggerHaptic } from '@/hooks/useHaptics';

const STORAGE_KEY = 'uf_rate_popup_last';
const REVIEWED_KEY = 'uf_reviewed';
const ONE_DAY = 24 * 60 * 60 * 1000;

interface Props {
  onOpenReview: () => void;
}

const RateUsPopup = ({ onOpenReview }: Props) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(REVIEWED_KEY)) return;
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (Date.now() - last < ONE_DAY) return;
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = (mark = true) => {
    if (mark) localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  const doIt = () => {
    triggerHaptic('medium');
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
    setTimeout(onOpenReview, 250);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[205] flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)' }}
          onClick={() => dismiss()}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto mb-24 rounded-3xl p-5 bg-card border border-border/50"
            style={{ boxShadow: '0 20px 60px -10px rgba(255,45,85,0.25)' }}
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.1 }}
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
                style={{ background: 'linear-gradient(135deg, #FF2D55, #FF6482)' }}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </motion.div>
              <h3 className="text-lg font-extrabold">Loving Universflow?</h3>
              <p className="text-sm text-muted-foreground mt-1 px-2">
                Take 10 seconds to rate us — it really keeps the music going ❤️
              </p>

              <div className="flex flex-col gap-2 mt-5">
                <button
                  onClick={doIt}
                  className="w-full h-11 rounded-2xl font-semibold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #FF2D55, #FF6482)' }}
                >
                  Let's do it ✨
                </button>
                <button
                  onClick={() => dismiss(true)}
                  className="w-full h-10 rounded-2xl font-medium text-xs text-muted-foreground bg-muted/30"
                >
                  Remind me later
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RateUsPopup;
