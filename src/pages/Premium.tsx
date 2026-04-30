import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Crown, Check, Sparkles, Download, Music2, Headphones,
  Zap, Heart, Gift, Copy, Loader2, ShieldCheck, Users, Sliders, Mic2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import PageTransition from '@/components/PageTransition';
import RedeemCodeModal from '@/components/RedeemCodeModal';
import { iosSpring, iosBounce } from '@/lib/animations';
import { usePremium } from '@/hooks/usePremium';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface UpiSettings {
  price: number;
  upiId: string;
  payeeName: string;
  enabled: boolean;
}

const FEATURES = [
  { icon: Zap,         title: 'Skip All Ads',         desc: 'No pre-roll, no interruptions. Just music.' },
  { icon: Sliders,     title: '8-Band Equalizer',     desc: 'Studio-grade sound shaping with presets.' },
  { icon: Headphones,  title: 'Advanced Audio Lab',   desc: 'Compressor, bass boost, vocal clarity.' },
  { icon: Download,    title: 'Unlimited Downloads',  desc: 'Listen offline. Anywhere. Forever.' },
  { icon: Users,       title: 'Play with Mate',       desc: 'Sync rooms — listen together in real time.' },
  { icon: Sparkles,    title: 'Premium-Only Tracks',  desc: 'Early drops and exclusive releases.' },
  { icon: Crown,       title: 'Premium Badge',        desc: 'Show your status across the app.' },
  { icon: ShieldCheck, title: 'Priority Support',     desc: 'Skip the line. We answer first.' },
];

const PremiumPage = memo(function PremiumPage() {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const haptics = useHaptics();
  const [showRedeem, setShowRedeem] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [settings, setSettings] = useState<UpiSettings | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['premium_price_inr', 'upi_id', 'upi_payee_name', 'premium_enabled']);
      const map: Record<string, any> = {};
      data?.forEach(r => {
        try { map[r.key] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value; }
        catch { map[r.key] = r.value; }
      });
      setSettings({
        price: Number(map.premium_price_inr ?? 49),
        upiId: String(map.upi_id ?? 'yourupi@okaxis'),
        payeeName: String(map.upi_payee_name ?? 'UniversFlow'),
        enabled: map.premium_enabled !== false,
      });
    })();
  }, []);

  const price = settings?.price ?? 49;

  const handleUpgrade = useCallback(() => {
    haptics.medium();
    setShowCheckout(true);
  }, [haptics]);

  return (
    <PageTransition>
      <motion.div
        className="min-h-screen bg-background pb-44 relative overflow-hidden"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      >
        {/* Static editorial backdrop */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-40 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 70%)', filter: 'blur(90px)' }}
        />
        <div
          className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 70%)', filter: 'blur(70px)' }}
        />

        {/* Header */}
        <motion.header
          className="sticky top-0 z-30 px-2 pt-4 pb-3 flex items-center safe-area-pt"
          style={{
            background: 'hsl(var(--background) / 0.85)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
          initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={iosSpring}
        >
          <motion.button
            onClick={() => { haptics.light(); navigate(-1); }}
            className="flex items-center gap-1 px-2 py-2 -ml-1 text-primary"
            whileTap={{ scale: 0.95, opacity: 0.7 }} transition={iosBounce}
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-[17px]">Back</span>
          </motion.button>
          <h1 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">Premium</h1>
        </motion.header>

        <main className="relative px-5 pt-2 space-y-8">
          {/* Editorial wordmark */}
          <motion.section
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...iosSpring, delay: 0.05 }}
            className="text-center pt-8 pb-2"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ ...iosSpring, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
              style={{ background: 'hsl(var(--primary) / 0.12)', border: '0.5px solid hsl(var(--primary) / 0.3)' }}
            >
              <Crown className="w-3.5 h-3.5 text-primary" fill="currentColor" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase">
                Universflow Premium
              </span>
            </motion.div>

            <h1 className="text-[44px] font-bold leading-[0.95] tracking-tight mb-4">
              Music,<br />
              <span style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>uninterrupted.</span>
            </h1>
            <p className="text-muted-foreground text-[15px] max-w-[320px] mx-auto leading-relaxed">
              One payment. Lifetime access. No subscriptions, no renewals.
            </p>
          </motion.section>

          {/* THE pricing card */}
          {!isPremium && (
            <motion.section
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.15 }}
            >
              <div
                className="relative rounded-[28px] p-7 overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, hsl(var(--primary) / 0.22) 0%, hsl(var(--card) / 0.7) 50%, hsl(var(--accent) / 0.15) 100%)',
                  border: '1px solid hsl(var(--primary) / 0.35)',
                  boxShadow: '0 30px 80px -20px hsl(var(--primary) / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                }}
              >
                <div
                  className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-50 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)', filter: 'blur(30px)' }}
                />

                <div className="relative">
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full"
                      style={{ background: 'hsl(var(--accent) / 0.2)', color: 'hsl(var(--accent))' }}>
                      Lifetime · One-time
                    </span>
                  </div>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-[32px] font-medium text-muted-foreground self-start mt-4">₹</span>
                    <span
                      className="text-[96px] font-bold leading-none tracking-tighter"
                      style={{
                        background: 'linear-gradient(180deg, hsl(var(--foreground)), hsl(var(--primary)))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                      }}
                    >
                      {price}
                    </span>
                  </div>
                  <p className="text-center text-[13px] text-muted-foreground mb-6">
                    Pay once via UPI · Activated automatically
                  </p>

                  <motion.button
                    onClick={handleUpgrade}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-[18px] rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                      color: 'hsl(var(--primary-foreground))',
                      boxShadow: '0 15px 40px -10px hsl(var(--primary) / 0.7)',
                    }}
                  >
                    Pay with UPI
                    <Sparkles className="w-5 h-5" fill="currentColor" />
                  </motion.button>

                  <button
                    onClick={() => { haptics.light(); setShowRedeem(true); }}
                    className="w-full mt-3 py-3 text-[14px] font-semibold text-primary flex items-center justify-center gap-1.5"
                  >
                    <Gift className="w-4 h-4" />
                    I have a redeem code
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {isPremium && (
            <motion.section
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={iosSpring}
              className="rounded-3xl p-8 text-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.15))',
                border: '1px solid hsl(var(--primary) / 0.4)',
              }}
            >
              <Crown className="w-12 h-12 text-primary mx-auto mb-3" fill="currentColor" />
              <p className="text-xl font-bold mb-1">You're Premium 💜</p>
              <p className="text-sm text-muted-foreground">Thanks for keeping the music alive.</p>
            </motion.section>
          )}

          {/* What's included */}
          <motion.section
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...iosSpring, delay: 0.25 }}
          >
            <div className="flex items-baseline justify-between mb-5 px-1">
              <h2 className="text-[22px] font-bold tracking-tight">What's inside</h2>
              <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                {FEATURES.length} perks
              </span>
            </div>

            <div className="space-y-2">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.04, ...iosSpring }}
                  className="flex items-center gap-4 p-4 rounded-2xl"
                  style={{ background: 'hsl(var(--card) / 0.5)', border: '0.5px solid hsl(var(--border) / 0.5)' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.08))' }}
                  >
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] leading-tight">{f.title}</p>
                    <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">{f.desc}</p>
                  </div>
                  <Check className="w-5 h-5 text-primary shrink-0" strokeWidth={3} />
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Closing CTA */}
          {!isPremium && (
            <motion.section
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...iosSpring, delay: 0.5 }}
              className="text-center py-6"
            >
              <p className="text-[24px] font-bold tracking-tight leading-tight mb-4">
                Ready when you are.
              </p>
              <motion.button
                onClick={handleUpgrade}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-[16px]"
                style={{ background: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
              >
                Unlock everything · ₹{price}
              </motion.button>
              <p className="text-[11px] text-muted-foreground mt-4">
                One-time payment · Instant activation · Lifetime access
              </p>
            </motion.section>
          )}
        </main>

        <BottomNav />

        <RedeemCodeModal isOpen={showRedeem} onClose={() => setShowRedeem(false)} />

        <AnimatePresence>
          {showCheckout && settings && (
            <UpiCheckoutSheet
              settings={settings}
              onClose={() => setShowCheckout(false)}
              onRedeem={() => { setShowCheckout(false); setShowRedeem(true); }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
});

// ─────────── UPI Checkout Sheet (3-step flow) ───────────

interface CheckoutProps {
  settings: UpiSettings;
  onClose: () => void;
  onRedeem: () => void;
}

type Step = 'pay' | 'confirm' | 'success';

const UpiCheckoutSheet = memo(function UpiCheckoutSheet({ settings, onClose, onRedeem }: CheckoutProps) {
  const haptics = useHaptics();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('pay');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Build a unique amount per user: base price + paise derived from user.id (1–99)
  const userPaise = user?.id
    ? (parseInt(user.id.replace(/[^0-9]/g, '').slice(-2) || '7', 10) % 99) + 1
    : 7;
  const amountRupees = settings.price;
  const amountFinal = `${amountRupees}.${String(userPaise).padStart(2, '0')}`;
  const amountPaise = amountRupees * 100 + userPaise;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.payeeName)}&am=${amountFinal}&cu=INR&tn=${encodeURIComponent(`Premium-${user?.id?.slice(0, 8) ?? ''}`)}`;

  const copyUpi = () => {
    navigator.clipboard.writeText(settings.upiId);
    haptics.light();
    toast({ title: 'UPI ID copied' });
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(amountFinal);
    haptics.light();
    toast({ title: 'Amount copied' });
  };

  const openUpiApp = () => {
    haptics.medium();
    window.location.href = upiUrl;
  };

  const submitUtr = async () => {
    if (!user) {
      toast({ title: 'Please sign in first', variant: 'destructive' });
      return;
    }
    const cleanUtr = utr.trim();
    if (cleanUtr.length < 6) {
      toast({ title: 'Enter a valid UTR / transaction ID', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        amount_paise: amountPaise,
        utr_number: cleanUtr,
        status: 'pending',
        plan: 'lifetime',
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'This transaction ID is already submitted', variant: 'destructive' });
        } else {
          toast({ title: 'Submission failed', description: error.message, variant: 'destructive' });
        }
        setSubmitting(false);
        return;
      }
      haptics.success();
      setStep('success');
    } catch (e) {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={iosSpring}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl p-6 pb-10 max-h-[92vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
          border: '0.5px solid hsl(var(--border))',
        }}
      >
        <div className="w-12 h-1 rounded-full bg-muted mx-auto mb-5" />

        {step === 'pay' && (
          <>
            <div className="text-center mb-5">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
              >
                <Crown className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-[20px] font-bold">Pay ₹{amountFinal}</h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                Unique amount helps us auto-match your payment
              </p>
            </div>

            {/* Big amount card */}
            <div
              className="rounded-2xl p-5 mb-3 text-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.12))',
                border: '0.5px solid hsl(var(--primary) / 0.3)',
              }}
            >
              <p className="text-[11px] tracking-widest uppercase text-muted-foreground mb-1">Amount</p>
              <button onClick={copyAmount} className="inline-flex items-center gap-2 group">
                <span className="text-[36px] font-bold tracking-tight">₹{amountFinal}</span>
                <Copy className="w-4 h-4 text-muted-foreground group-active:text-primary" />
              </button>
              <p className="text-[11px] text-muted-foreground mt-1">Tap to copy · Pay this exact amount</p>
            </div>

            {/* UPI ID */}
            <button
              onClick={copyUpi}
              className="w-full rounded-2xl p-4 mb-4 flex items-center justify-between"
              style={{ background: 'hsl(var(--muted) / 0.4)', border: '0.5px solid hsl(var(--border) / 0.5)' }}
            >
              <div className="text-left">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground">UPI ID</p>
                <p className="font-semibold text-[15px] mt-0.5">{settings.upiId}</p>
              </div>
              <Copy className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              onClick={openUpiApp}
              className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 mb-3"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                color: 'hsl(var(--primary-foreground))',
                boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.5)',
              }}
            >
              Open UPI app
            </button>

            <button
              onClick={() => { haptics.light(); setStep('confirm'); }}
              className="w-full py-3.5 rounded-2xl font-semibold text-[15px]"
              style={{ background: 'hsl(var(--muted) / 0.5)', border: '0.5px solid hsl(var(--border) / 0.5)' }}
            >
              I've paid · Submit transaction ID
            </button>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              onClick={onRedeem}
              className="w-full py-3 text-[14px] font-semibold text-primary flex items-center justify-center gap-1.5"
            >
              <Gift className="w-4 h-4" />
              Redeem a code instead
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <button onClick={() => setStep('pay')} className="text-[14px] text-primary mb-4 flex items-center">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h3 className="text-[22px] font-bold mb-1">Submit transaction ID</h3>
            <p className="text-[13px] text-muted-foreground mb-5">
              Find the 12-digit UTR / Transaction ID in your UPI app's payment receipt.
            </p>

            <input
              type="text"
              value={utr}
              onChange={e => setUtr(e.target.value)}
              placeholder="e.g. 412345678901"
              autoComplete="off"
              maxLength={30}
              className="w-full px-4 py-4 rounded-2xl text-[16px] font-mono tracking-wider mb-3 bg-transparent outline-none"
              style={{
                background: 'hsl(var(--muted) / 0.4)',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              }}
            />

            <div
              className="rounded-2xl p-3 mb-4 text-[12px] leading-relaxed"
              style={{ background: 'hsl(var(--primary) / 0.08)', border: '0.5px solid hsl(var(--primary) / 0.2)' }}
            >
              <p className="text-foreground/80">
                <strong className="text-primary">Auto-verify:</strong> We match the unique amount{' '}
                <strong>(₹{amountFinal})</strong> with your bank UTR. Premium activates within minutes.
              </p>
            </div>

            <button
              onClick={submitUtr}
              disabled={submitting || utr.trim().length < 6}
              className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                color: 'hsl(var(--primary-foreground))',
              }}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit & Activate'}
            </button>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={iosBounce}
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <Check className="w-10 h-10 text-primary-foreground" strokeWidth={3} />
            </motion.div>
            <h3 className="text-[22px] font-bold mb-2">Payment submitted</h3>
            <p className="text-[14px] text-muted-foreground mb-6 px-4">
              We're verifying your transaction. Premium activates within a few minutes — you'll see it instantly when it's done.
            </p>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-bold text-[16px]"
              style={{ background: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
            >
              Got it
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

export default PremiumPage;
