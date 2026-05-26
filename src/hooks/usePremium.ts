import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';
import { setRuntimePremium } from '@/lib/premiumState';

export type SubscriptionType = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

interface Subscription {
  id: string;
  subscription_type: SubscriptionType;
  status: SubscriptionStatus;
  expires_at: string | null;
  platform: string;
}

type SubscriptionRow = Record<string, unknown> | null;

interface UsePremiumReturn {
  isPremium: boolean;
  subscription: Subscription | null;
  verifiedStatus: boolean;
  subscriptionRow: SubscriptionRow;
  lastRealtimeUpdate: string | null;
  lastCheckedAt: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const CACHE_KEY = 'uf_premium_cache_v1';

interface CachedPremium {
  userId: string;
  subscription: Subscription | null;
  cachedAt: number;
}

const readCache = (userId: string | undefined): Subscription | null | undefined => {
  if (!userId) return undefined;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedPremium;
    if (parsed.userId !== userId) return undefined;
    // Treat cache as valid for 24h — the realtime fetch will overwrite it
    if (Date.now() - parsed.cachedAt > 24 * 60 * 60 * 1000) return undefined;
    return parsed.subscription;
  } catch {
    return undefined;
  }
};

const writeCache = (userId: string, subscription: Subscription | null) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ userId, subscription, cachedAt: Date.now() } satisfies CachedPremium),
    );
  } catch { /* ignore */ }
};

export const usePremium = (): UsePremiumReturn => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;

  // Hydrate subscription details from cache for display only. The actual
  // premium unlock flag below is NEVER taken from localStorage; it is verified
  // through the server RPC on every app start/refetch.
  const cached = readCache(user?.id);
  const [subscription, setSubscription] = useState<Subscription | null>(cached ?? null);
  const [subscriptionRow, setSubscriptionRow] = useState<SubscriptionRow>(null);
  const [verifiedPremium, setVerifiedPremium] = useState(false);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setSubscriptionRow(null);
      setVerifiedPremium(false);
      setLastRealtimeUpdate(null);
      setLastCheckedAt(null);
      setIsLoading(false);
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return;
    }

    try {
      setError(null);

      const [premiumResult, subscriptionResult] = await Promise.all([
        supabase.rpc('has_premium_subscription', { _user_id: user.id }),
        supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (premiumResult.error) throw premiumResult.error;
      setVerifiedPremium(premiumResult.data === true);

      if (subscriptionResult.error) throw subscriptionResult.error;
      setSubscriptionRow((subscriptionResult.data ?? null) as SubscriptionRow);

      let next: Subscription | null = null;
      if (subscriptionResult.data) {
        const isExpired = subscriptionResult.data.expires_at && new Date(subscriptionResult.data.expires_at) < new Date();
        next = {
          id: subscriptionResult.data.id,
          subscription_type: subscriptionResult.data.subscription_type as SubscriptionType,
          status: isExpired ? 'expired' : (subscriptionResult.data.status as SubscriptionStatus),
          expires_at: subscriptionResult.data.expires_at,
          platform: subscriptionResult.data.platform,
        };
      }
      setSubscription(next);
      writeCache(user.id, next);
      setLastCheckedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
      // Fail closed for unlocks. Cached subscription text may remain visible,
      // but paid capabilities are not enabled unless the server verified them.
      setVerifiedPremium(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`premium-status-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        setLastRealtimeUpdate(new Date().toISOString());
        fetchSubscription();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSubscription]);

  useEffect(() => {
    if (!user) return;

    const poll = window.setInterval(() => {
      fetchSubscription();
    }, verifiedPremium ? 30000 : 4000);

    return () => window.clearInterval(poll);
  }, [user, verifiedPremium, fetchSubscription]);

  const isPremium = verifiedPremium;

  // Mirror the server-verified value into a runtime flag that other modules
  // (PlayerContext, useGlobalAudioEngine) read instead of localStorage —
  // localStorage can be edited from DevTools, this in-memory flag cannot
  // be flipped without also patching the JS bundle.
  useEffect(() => {
    setRuntimePremium(!!isPremium);
  }, [isPremium]);

  return {
    isPremium,
    subscription,
    verifiedStatus: verifiedPremium,
    subscriptionRow,
    lastRealtimeUpdate,
    lastCheckedAt,
    isLoading,
    error,
    refetch: fetchSubscription,
  };
};

export default usePremium;
