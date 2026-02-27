import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  isOffline: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ── Helpers ──────────────────────────────────────────────── */

async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function generateShareCode(userId: string) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', userId)
      .single();
    if (data && !data.share_code) {
      const code = Math.random().toString(36).substring(2, 10);
      await supabase.from('profiles').update({ share_code: code }).eq('user_id', userId);
    }
  } catch {
    // non-critical
  }
}

/**
 * Quick connectivity check — pings the Supabase health endpoint.
 * Returns true if reachable, false otherwise.
 */
async function isBackendReachable(): Promise<boolean> {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${url}/auth/v1/settings`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Provider ─────────────────────────────────────────────── */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Track online/offline
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Auth state listener + initial session
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          const admin = await checkIsAdmin(newSession.user.id);
          if (mounted) setIsAdmin(admin);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // Get existing session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const admin = await checkIsAdmin(s.user.id);
        if (mounted) setIsAdmin(admin);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });

    // Safety timeout
    const timer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  /* ── signUp ───────────────────────────────────────────── */
  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ? (error as unknown as Error) : null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  }, []);

  /* ── signIn ───────────────────────────────────────────── */
  const signIn = useCallback(async (email: string, password: string) => {
    // Skip pre-check — go directly to sign in for faster + more reliable login
    if (!navigator.onLine) {
      return { error: new Error('You are offline. Connect to the internet and try again.') };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { error: error as unknown as Error };
      }

      if (data.user) {
        void generateShareCode(data.user.id);
        const admin = await checkIsAdmin(data.user.id);
        setIsAdmin(admin);
        return { error: null, isAdmin: admin };
      }

      return { error: null, isAdmin: false };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  }, []);

  /* ── signOut ──────────────────────────────────────────── */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, isAdmin, isLoading, isOffline, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
