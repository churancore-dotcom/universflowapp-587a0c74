import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/contexts/AuthContext';

export type SubscriptionType = 'free' | 'premium_monthly' | 'premium_yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

interface Subscription {
  id: string;
  subscription_type: SubscriptionType;
  status: SubscriptionStatus;
  expires_at: string | null;
  platform: string;
}

interface UsePremiumReturn {
  isPremium: boolean;
  subscription: Subscription | null;
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

  // Hydrate from cache SYNCHRONOUSLY so premium users never flash the
  // "Upgrade to Premium" UI on mount.
  const cached = readCache(user?.id);
  const [subscription, setSubscription] = useState<Subscription | null>(cached ?? null);
  // If we have a cached value we're effectively "ready" — only show loading
  // when there's truly nothing to render with.
  const [isLoading, setIsLoading] = useState(cached === undefined);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
      return;
    }

    try {
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let next: Subscription | null = null;
      if (data) {
        const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
        next = {
          id: data.id,
          subscription_type: data.subscription_type as SubscriptionType,
          status: isExpired ? 'expired' : (data.status as SubscriptionStatus),
          expires_at: data.expires_at,
          platform: data.platform,
        };
      }
      setSubscription(next);
      writeCache(user.id, next);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch subscription'));
      // Don't clobber cached value on transient errors — keeps the UI stable
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isPremium =
    subscription?.status === 'active' &&
    subscription?.subscription_type !== 'free' &&
    (!subscription?.expires_at || new Date(subscription.expires_at) > new Date());

  return {
    isPremium,
    subscription,
    isLoading,
    error,
    refetch: fetchSubscription,
  };
};

export default usePremium;
