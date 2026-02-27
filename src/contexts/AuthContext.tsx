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

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      const isUserAdmin = !!data;
      setIsAdmin(isUserAdmin);
      return isUserAdmin;
    } catch {
      setIsAdmin(false);
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
      // Non-blocking
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && nextSession?.user) {
        setTimeout(() => {
          checkAdminStatus(nextSession.user.id);
          ensureShareCode(nextSession.user.id);
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
      }
    });

    const timeoutId = setTimeout(() => setIsLoading(false), 5000);

    supabase.auth.getSession()
      .then(async ({ data: { session: existingSession } }) => {
        clearTimeout(timeoutId);
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          await checkAdminStatus(existingSession.user.id);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signInViaXhr = async (email: string, password: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    return await new Promise<{ access_token: string; refresh_token: string; user: { id: string } }>((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl}/auth/v1/token?grant_type=password`, true);
        xhr.timeout = 12000;

        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        xhr.setRequestHeader('apikey', publishableKey);
        xhr.setRequestHeader('Authorization', `Bearer ${publishableKey}`);

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300 && response?.access_token && response?.refresh_token) {
              resolve(response);
              return;
            }
            reject(new Error(response?.error_description || response?.msg || 'Login failed'));
          } catch {
            reject(new Error('Invalid login response'));
          }
        };

        xhr.onerror = () => reject(new Error('NetworkError: XHR login failed'));
        xhr.ontimeout = () => reject(new Error('Timeout: XHR login request timed out'));

        xhr.send(JSON.stringify({ email, password }));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('XHR login setup failed'));
      }
    });
  };

  const signIn = async (email: string, password: string) => {
    const maxRetries = 2;
    let lastError: Error | null = null;

    const isNetworkErrorMessage = (message?: string) => {
      if (!message) return false;
      const normalized = message.toLowerCase();
      return normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('timeout');
    };

    const resolveAdminStatus = async (userId: string) => {
      try {
        return await Promise.race<boolean>([
          checkAdminStatus(userId),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
        ]);
      } catch {
        return false;
      }
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const signInRequest = supabase.auth.signInWithPassword({ email, password });
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout. Please try again.')), 12000)
        );

        const { data, error } = await Promise.race([signInRequest, timeout]);

        if (error) {
          if (isNetworkErrorMessage(error.message) && attempt < maxRetries) {
            console.warn(`signIn network retry ${attempt + 1}/${maxRetries}:`, error.message);
            lastError = error as Error;
            await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
            continue;
          }

          console.error('signIn failed:', error);
          return { error: error as Error };
        }

        if (data.user) {
          void ensureShareCode(data.user.id);
          const isUserAdmin = await resolveAdminStatus(data.user.id);
          return { error: null, isAdmin: isUserAdmin };
        }

        return { error: null, isAdmin: false };
      } catch (err) {
        const asError = err instanceof Error ? err : new Error('Login failed');

        if (isNetworkErrorMessage(asError.message) && attempt < maxRetries) {
          console.warn(`signIn exception retry ${attempt + 1}/${maxRetries}:`, asError.message);
          lastError = asError;
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }

        console.error('signIn exception:', asError);
        lastError = asError;
        break;
      }
    }

    if (lastError && isNetworkErrorMessage(lastError.message)) {
      try {
        console.warn('Trying XHR fallback login...');
        const session = await signInViaXhr(email, password);

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (sessionError) {
          console.error('setSession failed after XHR fallback:', sessionError);
          return { error: sessionError as Error };
        }

        void ensureShareCode(session.user.id);
        const isUserAdmin = await resolveAdminStatus(session.user.id);
        return { error: null, isAdmin: isUserAdmin };
      } catch (xhrError) {
        const fallbackError = xhrError instanceof Error ? xhrError : new Error('Login failed');
        console.error('XHR fallback login failed:', fallbackError);
        return { error: fallbackError };
      }
    }

    return { error: lastError || new Error('Connection failed. Please try again.') };
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
