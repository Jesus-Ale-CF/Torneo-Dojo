import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }
interface Ctx { toast: (text: string, kind?: Kind) => void; success: (t: string) => void; error: (t: string) => void }
const C = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const toast = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++n.current;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ toast, success: (t: string) => toast(t, 'success'), error: (t: string) => toast(t, 'error') }), [toast]);
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const color = { success: 'border-tatami text-tatami', error: 'border-shu text-shu', info: 'border-ai text-ai' };
  return (
    <C.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:bottom-6 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.kind];
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}
                className={`pointer-events-auto card flex max-w-md items-start gap-3 border-l-4 px-4 py-3 ${color[t.kind]}`}>
                <I className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <p className="text-sm text-ink">{t.text}</p>
                <button onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))} className="ml-auto -mr-1 rounded p-1 text-muted hover:text-ink" aria-label="Cerrar aviso"><X className="h-4 w-4" /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </C.Provider>
  );
}
export function useToast() {
  const c = useContext(C);
  if (!c) throw new Error('useToast fuera de ToastProvider');
  return c;
}
