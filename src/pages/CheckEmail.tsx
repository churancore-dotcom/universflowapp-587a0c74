import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import appLogo from '@/assets/app-logo.png';

const CheckEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = (location.state || {}) as { email?: string; username?: string };
  // Prefer router state, fall back to URL query (survives reloads / direct opens)
  const email = state.email || params.get('email') || '';
  const username = state.username || params.get('u') || '';

  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/auth', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-link', {
        body: { email, username },
      });
      if (error) {
        const ctx = (error as { context?: Response })?.context;
        let msg = 'Could not send email';
        try {
          if (ctx) {
            const j = await ctx.clone().json();
            if (typeof j?.error === 'string') msg = j.error;
          }
        } catch { /* keep */ }
        toast.error(msg);
      } else if (data?.already) {
        toast.success('Your email is already verified — sign in below.');
        navigate('/auth');
      } else {
        toast.success('Verification email sent again');
        setCooldown(60);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-5 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, hsl(340 100% 50% / 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(260 100% 60% / 0.15) 0%, transparent 50%)',
        }}
      />

      <motion.div
        className="relative w-full max-w-sm z-10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="mx-auto w-24 h-24 rounded-full overflow-hidden mb-6"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            background: '#000',
            boxShadow: '0 0 28px hsl(var(--primary) / 0.35)',
          }}
        >
          <img src={appLogo} alt="Universflow" className="w-full h-full object-cover" />
        </motion.div>

        <motion.div
          className="rounded-3xl p-7 space-y-5"
          style={{
            background: 'rgba(28, 28, 30, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16 }}
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FF2D55, #BF5AF2)',
              boxShadow: '0 8px 30px hsl(340 100% 50% / 0.35)',
            }}
          >
            <Mail className="w-8 h-8 text-white" />
          </motion.div>

          <div>
            <h1 className="text-xl font-bold mb-1.5">Confirm your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-semibold text-foreground mt-1 break-all">{email}</p>
          </div>

          <div className="text-xs text-muted-foreground space-y-2 text-left bg-white/[0.03] rounded-xl p-3.5 border border-white/5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span>Open the email and tap <strong className="text-foreground">Confirm my email</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span>The link expires in 24 hours</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span>Check your spam folder if you don't see it</span>
            </div>
          </div>

          <Button
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            variant="outline"
            className="w-full h-12 rounded-xl"
          >
            {resending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Resend email
              </span>
            )}
          </Button>

          <button
            onClick={() => navigate('/auth')}
            className="text-xs text-muted-foreground active:opacity-70 flex items-center gap-1.5 mx-auto"
          >
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CheckEmail;
