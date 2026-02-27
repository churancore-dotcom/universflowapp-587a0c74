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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Clear any stale auth tokens on mount BEFORE setting up listeners
    // This prevents the SDK from endlessly retrying a bad refresh token
    const clearStaleTokens = () => {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.includes('auth-token') || key.includes('supabase.auth')) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                // If the token has expired or has no valid access_token, remove it
                const expiresAt = parsed?.expires_at;
                if (expiresAt && expiresAt * 1000 < Date.now()) {
                  console.log('Removing expired auth token from storage');
                  localStorage.removeItem(key);
                }
              }
            } catch {
              // If we can't parse it, it's corrupted — remove it
              localStorage.removeItem(key);
            }
          }
        }
      } catch {}
    };
    
    clearStaleTokens();

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session?.user) {
            setTimeout(() => checkAdminStatus(session.user.id), 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session — with a hard 4s timeout
    const sessionTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      setIsLoading(false);
    }).catch(() => {
      clearTimeout(sessionTimeout);
      // Session restore failed — force sign out to clear all stale data
      supabase.auth.signOut().catch(() => {});
      setIsLoading(false);
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!data);
    } catch {
      setIsAdmin(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    // Profile is created automatically by the handle_new_user trigger.
    // Update share_code in the background after signup succeeds.
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Sign out cleanly first to clear any stale session
      await supabase.auth.signOut().catch(() => {});

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error as Error };
      }

      // Do admin check in background — don't block login
      if (data.user) {
        const userId = data.user.id;
        
        // Fire-and-forget: ensure share_code exists
        Promise.resolve(
          supabase
            .from('profiles')
            .select('share_code')
            .eq('user_id', userId)
            .single()
        ).then(({ data: profile }) => {
            if (profile && !profile.share_code) {
              const newShareCode = Math.random().toString(36).substring(2, 10);
              Promise.resolve(supabase.from('profiles').update({ share_code: newShareCode }).eq('user_id', userId)).catch(() => {});
            }
          }).catch(() => {});

        // Admin check — 2s timeout max
        try {
          const adminResult = await Promise.race([
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .eq('role', 'admin')
              .maybeSingle(),
            new Promise<{ data: null }>((resolve) => 
              setTimeout(() => resolve({ data: null }), 2000)
            ),
          ]);
          
          const adminStatus = !!(adminResult as any)?.data;
          setIsAdmin(adminStatus);
          return { error: null, isAdmin: adminStatus };
        } catch {
          setIsAdmin(false);
          return { error: null, isAdmin: false };
        }
      }

      return { error: null, isAdmin: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Check your connection.';
      return { error: new Error(message) };
    }
  };

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