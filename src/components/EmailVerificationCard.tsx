import { useState } from 'react';
import { CheckCircle2, MailWarning, Loader2 } from 'lucide-react';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { compact?: boolean }

/**
 * Inline status card that surfaces email verification state on Profile/Settings.
 * Shows a green confirmation when verified, or a 6-digit code flow otherwise.
 */
export const EmailVerificationCard = ({ compact = false }: Props) => {
  const { user, isVerified, sendCode, refresh } = useEmailVerified();
  const [sending, setSending] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  if (!user) return null;

  if (isVerified) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 ${compact ? 'py-2.5' : 'py-3'}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Email verified</p>
          {!compact && <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>}
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    setSending(true);
    try {
      const ok = await sendCode();
      if (ok) setShowCode(true);
    } finally { setSending(false); }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const { error } = await supabase.functions.invoke('verify-email-code', { body: { code } });
      if (error) {
        const msg = (error as any)?.context?.error || error.message || 'Verification failed';
        toast.error(msg);
        return;
      }
      toast.success('Email verified!');
      setShowCode(false);
      setCode('');
      await refresh();
    } finally { setVerifying(false); }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <MailWarning className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-[13px] font-semibold text-foreground">Verify your email</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        We'll send a 6-digit code to <span className="font-medium text-foreground">{user.email}</span>. Some actions are locked until you confirm.
      </p>

      {showCode && (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full h-11 text-center text-lg font-bold rounded-lg bg-background/60 border border-border/40 outline-none focus:border-primary"
          style={{ letterSpacing: '0.4em' }}
        />
      )}

      <div className="flex gap-2">
        {showCode ? (
          <>
            <button
              onClick={handleVerify}
              disabled={code.length !== 6 || verifying}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold py-2 active:scale-[0.98] disabled:opacity-60"
            >
              {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 inline-flex items-center justify-center rounded-full bg-card border border-border/40 text-[12px] text-muted-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Resend'}
            </button>
          </>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold py-2 active:scale-[0.98] disabled:opacity-60"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {sending ? 'Sending…' : 'Send verification code'}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationCard;
