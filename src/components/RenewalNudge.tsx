import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight } from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Shows a soft renewal nudge on the Profile/Premium pages when a premium
 * subscription is within 7 days of expiring. Silent otherwise.
 */
const RenewalNudge = memo(function RenewalNudge() {
  const navigate = useNavigate();
  const { isPremium, subscription } = usePremium();
  const haptics = useHaptics();

  const daysLeft = useMemo(() => {
    if (!isPremium || !subscription?.expires_at) return null;
    const ms = new Date(subscription.expires_at).getTime() - Date.now();
    if (ms <= 0) return null;
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }, [isPremium, subscription?.expires_at]);

  if (daysLeft === null || daysLeft > 7) return null;

  return (
    <button
      onClick={() => { haptics.light(); navigate('/premium'); }}
      className="w-full mt-3 rounded-xl p-3 text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.08))',
        border: '1px solid rgba(251, 191, 36, 0.25)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
      >
        <Clock className="w-4 h-4 text-black" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {daysLeft <= 1 ? 'Premium expires today' : `Premium expires in ${daysLeft} days`}
        </p>
        <p className="text-[10px] text-muted-foreground">Tap to renew and keep ad-free listening</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
});

export default RenewalNudge;
