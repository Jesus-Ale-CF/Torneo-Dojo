import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { retryNow, serverStatus } from '@/lib/serverStatus';

/**
 * Aviso de arranque en frío (backend gratuito de Render dormido). Aparece si una petición tarda > 3 s
 * o falla por red; desaparece solo cuando el servidor responde y entonces se recargan los datos.
 */
export function ServerWakeNotice() {
  const phase = useSyncExternalStore(serverStatus.subscribe, serverStatus.get);
  const qc = useQueryClient();
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Al volver el servidor: recargar todo lo que esté en pantalla (incluidas las consultas que fallaron)
  useEffect(() => serverStatus.onRecovered(() => { void qc.invalidateQueries(); }), [qc]);

  useEffect(() => {
    if (phase === 'ok') { setSince(null); return; }
    setSince((s) => s ?? Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const seconds = since ? Math.max(0, Math.round((now - since) / 1000)) : 0;
  const down = phase === 'down';

  const retry = async () => {
    setBusy(true);
    try { await retryNow(); } finally { setBusy(false); }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[110] flex justify-center px-4">
      {/* La región viva existe siempre para que los lectores de pantalla anuncien el aviso al aparecer */}
      <div role="status" aria-live="polite" className="w-full max-w-md">
        <AnimatePresence>
          {phase !== 'ok' && (
            <motion.div
              key="wake"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className={`pointer-events-auto card flex items-start gap-3 border-l-4 px-4 py-3 shadow-lift ${down ? 'border-l-warn' : 'border-l-ai'}`}
              data-testid="server-wake-notice"
            >
              {down
                ? <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden />
                : <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-ai motion-reduce:animate-none" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {down ? 'El servidor aún no responde' : 'Despertando el servidor, puede tardar hasta un minuto…'}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {down
                    ? 'Seguimos intentándolo automáticamente. Puedes esperar o reintentar ahora.'
                    : 'La demo gratuita se duerme cuando no hay visitas. Enseguida cargamos los datos.'}
                  {seconds >= 3 && <span className="num" aria-hidden> · {seconds} s</span>}
                </p>
                {down && (
                  <button type="button" className="btn-secondary mt-2 min-h-touch px-3 text-sm" onClick={retry} disabled={busy}>
                    <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden />
                    {busy ? 'Comprobando…' : 'Reintentar'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
