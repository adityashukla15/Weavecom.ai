import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearAccessToken, setAccessToken } from '../api/client.js';
import { authService } from '../api/services/authService.js';
import { supabase, supabaseConfigurationError } from '../api/supabase.js';

const AuthContext = createContext(null);

function isUnauthorized(error) {
  return error?.status === 401;
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(supabaseConfigurationError ? 'unconfigured' : 'loading');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const generation = useRef(0);

  const loadSession = useCallback(async (session) => {
    const requestGeneration = ++generation.current;
    setAuthError('');

    if (!session?.access_token) {
      clearAccessToken();
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }

    setAccessToken(session.access_token);
    setStatus('loading');

    try {
      const profile = await authService.getProfile();
      if (requestGeneration === generation.current) {
        setUser(profile);
        setStatus('authenticated');
      }
      return profile;
    } catch (error) {
      if (requestGeneration !== generation.current) return null;
      if (isUnauthorized(error)) {
        clearAccessToken();
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }
      setAuthError(error.message || 'Unable to verify your account. Please try again.');
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) void loadSession(session);
      });
    });

    const handleUnauthorized = () => {
      generation.current += 1;
      clearAccessToken();
      setUser(null);
      setAuthError('');
      setStatus('unauthenticated');
      void authService.clearLocalSession();
    };
    window.addEventListener('panelverse:unauthorized', handleUnauthorized);

    authService.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError('Unable to restore your session. Please sign in again.');
        setStatus('error');
        return;
      }
      void loadSession(data.session);
    }).catch(() => {
      if (active) {
        setAuthError('Unable to restore your session. Please sign in again.');
        setStatus('error');
      }
    });

    return () => {
      active = false;
      generation.current += 1;
      subscription.unsubscribe();
      window.removeEventListener('panelverse:unauthorized', handleUnauthorized);
      clearAccessToken();
    };
  }, [loadSession]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await authService.signIn(email, password);
    if (error) throw error;
    const profile = await loadSession(data.session);
    return { ...data, profile };
  }, [loadSession]);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await authService.signUp(email, password);
    if (error) throw error;
    const profile = data.session ? await loadSession(data.session) : null;
    return { ...data, profile };
  }, [loadSession]);

  const signOut = useCallback(async () => {
    clearAccessToken();
    setUser(null);
    setStatus('unauthenticated');
    const { error } = await authService.signOut();
    if (error) throw error;
  }, []);

  const retryProfile = useCallback(async () => {
    const { data, error } = await authService.getSession();
    if (error) {
      setAuthError('Unable to restore your session. Please sign in again.');
      setStatus('error');
      return;
    }
    await loadSession(data.session);
  }, [loadSession]);

  const value = useMemo(() => ({
    status,
    user,
    authError,
    signIn,
    signUp,
    signOut,
    retryProfile,
  }), [status, user, authError, signIn, signUp, signOut, retryProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
