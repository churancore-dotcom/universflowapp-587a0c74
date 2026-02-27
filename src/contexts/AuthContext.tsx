import React, { createContext, useContext, useState, useEffect } from 'react';
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

/* ── helpers ─────────────────────────────────────────────────── */

const fetchAdminStatus = async (userId: string): Promise<boolean> => {
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
};

const ensureShareCode = async (userId: string) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', userId)
      .single();

    if (profile && !profile.share_code) {
      const code = Math.random().toString(36).substring(2, 10);
      await supabase.from('profiles').update({ share_code: code }).eq('user_id', userId);
    }
  } catch {
    // non-blocking
  }
};

/* ── provider ────────────────────────────────────────────────── */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Online / offline tracking
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auth state listener + initial session
  useEffect(() => {
    // 1. Listen for auth changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const admin = await fetchAdminStatus(newSession.user.id);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }
    });

    // 2. Then get existing session
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        const admin = await fetchAdminStatus(existing.user.id);
        setIsAdmin(admin);
      }

      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    // Safety net — never stay loading forever
    const safetyTimeout = setTimeout(() => setIsLoading(false), 5000);

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  /* ── signUp ──────────────────────────────────────────────── */
  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  };

  /* ── signIn ──────────────────────────────────────────────── */
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { error: error as Error };
      }

      if (data.user) {
        void ensureShareCode(data.user.id);
        const admin = await fetchAdminStatus(data.user.id);
        setIsAdmin(admin);
        return { error: null, isAdmin: admin };
      }

      return { error: null, isAdmin: false };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  /* ── signOut ─────────────────────────────────────────────── */
  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, isOffline, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
