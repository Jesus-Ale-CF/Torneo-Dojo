import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Pref = 'light' | 'dark' | 'system';
interface ThemeCtx { pref: Pref; resolved: 'light' | 'dark'; setPref: (p: Pref) => void; cycle: () => void }
const Ctx = createContext<ThemeCtx | null>(null);
const KEY = 'zenkai-theme';

function systemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<Pref>(() => { try { return (localStorage.getItem(KEY) as Pref) || 'system'; } catch { return 'system'; } });
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = (e: MediaQueryListEvent) => setSys(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const resolved: 'light' | 'dark' = pref === 'system' ? (sys ? 'dark' : 'light') : pref;
  useEffect(() => { document.documentElement.dataset.theme = resolved; }, [resolved]);
  const setPref = useCallback((p: Pref) => { setPrefState(p); try { p === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p); } catch { /* ignore */ } }, []);
  const cycle = useCallback(() => setPref(pref === 'system' ? 'light' : pref === 'light' ? 'dark' : 'system'), [pref, setPref]);
  const value = useMemo(() => ({ pref, resolved, setPref, cycle }), [pref, resolved, setPref, cycle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme fuera de ThemeProvider');
  return c;
}
