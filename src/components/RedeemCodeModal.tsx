import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Crown, Check, Loader2, Sparkles } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePremium } from '@/hooks/usePremium';
import { toast } from '@/hooks/use-toast';
import { iosSpring, iosBounce } from '@/lib/animations';

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RedeemCodeModal = memo(function RedeemCodeModal({ isOpen, onClose }: RedeemCodeModalProps) {
  const { user } = useAuth();
  const { refetch } = usePremium();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleRedeem = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter a code');
      return;
    }

    if (!user) {
      setError('You must be logged in');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use atomic database function to prevent race conditions
      const { data, error: redeemError } = await supabase
        .rpc('redeem_promo_code', {
          p_code: code.trim()
        });

      if (redeemError) {
        console.error('Redemption error:', redeemError);
        setError('Failed to redeem code. Please try again.');
        setLoading(false);
        return;
      }

      // Check result from the function
      const result = data as { success: boolean; error?: string };
      
      if (!result?.success) {
        setError(result?.error || 'Invalid or expired code');
        setLoading(false);
        return;
      }

      setSuccess(true);
      refetch();
      toast({ title: '🎉 Welcome to Premium!', description: 'You now have lifetime premium access!' });
      
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCode('');
      }, 2000);

    } catch (err) {
      console.error('Redemption exception:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, user, refetch, onClose]);

  const handleClose = () => {
    setCode('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[85vh] bg-black/95 border-t border-white/10 rounded-t-3xl p-0"
      >
        <motion.div
          className="p-6 pb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={iosSpring}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <motion.div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={iosBounce}
              >
                <Gift className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold">Redeem Code</h2>
                <p className="text-sm text-muted-foreground">Enter your premium access code</p>
              </div>
            </div>
            <motion.button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10"
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={iosBounce}
              >
                <motion.div
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...iosBounce, delay: 0.1 }}
                >
                  <Crown className="w-10 h-10 text-white" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="text-2xl font-bold mb-2">Welcome to Premium!</h3>
                  <p className="text-muted-foreground">You now have lifetime access to all features</p>
                </motion.div>
                <motion.div
                  className="flex flex-wrap justify-center gap-2 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {['Ad-free', 'Offline', 'Lossless', 'Unlimited'].map((benefit) => (
                    <span
                      key={benefit}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400"
                    >
                      <Check className="w-3 h-3 inline mr-1" />
                      {benefit}
                    </span>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Code Input */}
                <div className="space-y-4">
                  <div>
                    <Input
                      placeholder="Enter your code (e.g., PREMIUM-ABC123)"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase());
                        setError('');
                      }}
                      className="h-14 text-center text-lg font-mono tracking-wider bg-black/30 border-white/10 focus:border-amber-500/50"
                      maxLength={30}
                    />
                    {error && (
                      <motion.p
                        className="text-red-400 text-sm mt-2 text-center"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {error}
                      </motion.p>
                    )}
                  </div>

                  <Button
                    onClick={handleRedeem}
                    disabled={loading || !code.trim()}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-5 h-5 mr-2" />
                    )}
                    {loading ? 'Validating...' : 'Unlock Premium'}
                  </Button>
                </div>

                {/* Benefits Preview */}
                <motion.div
                  className="mt-6 p-4 rounded-xl"
                  style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-sm text-amber-300/80 text-center">
                    <Crown className="w-4 h-4 inline mr-1" />
                    Premium includes ad-free listening, offline downloads, lossless audio, and all exclusive features forever!
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
});

export default RedeemCodeModal;
