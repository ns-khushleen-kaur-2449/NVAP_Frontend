import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SESSION_KEY } from '../api/client';
import { authApi } from '../api/services';

/**
 * NVIP session: the signed-in user, their role and their tenant.
 */
const SessionContext = createContext(null);

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(readStored);

  const persist = useCallback((next) => {
    setSession(next);
    try {
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked — session lives in memory only */
    }
  }, []);

  const signIn = useCallback(async (credentials) => {
    const result = await authApi.signIn(credentials);
    persist(result);
    return result;
  }, [persist]);

  const signOut = useCallback(() => persist(null), [persist]);

  useEffect(() => {
    const onUnauthorized = () => persist(null);
    window.addEventListener('nvip:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nvip:unauthorized', onUnauthorized);
  }, [persist]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    tenant: session?.tenant ?? null,
    role: session?.user?.role ?? null,
    signIn,
    signOut,
  }), [session, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
