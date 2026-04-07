import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAuthError } from '@/lib/errorMessages';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const ensureUserProfile = useCallback(async (sessionUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', sessionUser.id)
        .maybeSingle();

      if (error || data) return;

      const { error: insertError } = await supabase.from('profiles').insert({
        user_id: sessionUser.id,
        email: sessionUser.email ?? null,
      });

      if (insertError && insertError.code !== '23505') {
        console.error('Profile bootstrap failed:', insertError);
      }
    } catch (error) {
      console.error('Profile bootstrap failed:', error);
    }
  }, []);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
      setIsAdmin(!!data);
      return !!data;
    } catch {
      setIsAdmin(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(async () => {
          await ensureUserProfile(nextSession.user);
          await checkAdminRole(nextSession.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
      }

      setIsLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        await ensureUserProfile(existingSession.user);
        await checkAdminRole(existingSession.user.id);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAdminRole, ensureUserProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: new Error(getAuthError(error)) };

      if (data.user) {
        await ensureUserProfile(data.user);
        
        // Check if user is banned or suspended
        const { data: profile } = await supabase
          .from('profiles')
          .select('status')
          .eq('user_id', data.user.id)
          .maybeSingle();
        
        if (profile?.status === 'banned') {
          await supabase.auth.signOut();
          return { error: new Error('Your account has been banned. Contact support for help.') };
        }
        if (profile?.status === 'suspended') {
          await supabase.auth.signOut();
          return { error: new Error('Your account is temporarily suspended. Please try again later.') };
        }
      }

      const admin = data.user ? await checkAdminRole(data.user.id) : false;
      return { error: null, isAdmin: admin };
    } catch (error) {
      return { error: new Error(getAuthError(error)) };
    }
  }, [checkAdminRole, ensureUserProfile]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) return { error: new Error(getAuthError(error)) };
      return { error: null };
    } catch (error) {
      return { error: new Error(getAuthError(error)) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, isAdmin, isLoading, isOffline: !navigator.onLine, signIn, signUp, signOut }}
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
