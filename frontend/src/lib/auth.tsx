import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, get, isTransientError, post, tokenStore } from './api';
import { serverStatus } from './serverStatus';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setLoading(false); return; }
    try {
      setUser(await get<User>('/auth/me'));
      setLoading(false);
    } catch (e) {
      // Solo un 401 invalida la sesión. Si el servidor está dormido o sin red se conserva el token y se
      // sigue "cargando" (con el aviso de arranque en frío visible) hasta que vuelva y se reintente.
      if (e instanceof ApiError && e.status === 401) { tokenStore.set(null); setUser(null); setLoading(false); }
      else if (!isTransientError(e)) { setUser(null); setLoading(false); }
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => serverStatus.onRecovered(() => { if (tokenStore.get()) void refresh(); }), [refresh]);
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('zenkai:logout', onLogout);
    return () => window.removeEventListener('zenkai:logout', onLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  }, []);
  const logout = useCallback(() => { tokenStore.set(null); setUser(null); }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de AuthProvider');
  return c;
}
