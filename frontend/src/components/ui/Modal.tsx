import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const FIELD = 'input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled])';

/**
 * Diálogo modal accesible.
 *
 * El efecto de apertura depende SOLO de `open`: `onClose` se lee de una ref, así que un `onClose`
 * inline (nuevo en cada render del padre) no vuelve a ejecutar el efecto. Antes, cada pulsación
 * en un campo re-renderizaba el padre, el efecto se re-ejecutaba y su autofoco mandaba el foco al
 * primer enfocable del diálogo, que era el botón "Cerrar".
 *
 * - Foco inicial una sola vez al abrir: `[data-autofocus]` → primer campo del cuerpo → primer botón del pie → el diálogo.
 * - Tab / Shift+Tab quedan atrapados dentro del diálogo; Esc cierra; al cerrar el foco vuelve a quien lo abrió.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Foco inicial (una sola vez por apertura)
    const raf = requestAnimationFrame(() => {
      const target =
        ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        bodyRef.current?.querySelector<HTMLElement>(FIELD) ??
        footRef.current?.querySelector<HTMLElement>('button:not([disabled])') ??
        ref.current;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  const w = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => onCloseRef.current()} aria-hidden />
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`card relative flex max-h-[92dvh] w-full flex-col rounded-b-none shadow-lift outline-none sm:rounded-dojo ${w}`}>
            <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <h2 id="modal-title" className="text-lg">{title}</h2>
              <button type="button" onClick={() => onCloseRef.current()} className="btn-ghost -mr-2 h-11 w-11 px-0" aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </header>
            <div ref={bodyRef} className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer ref={footRef} className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirmar', danger = false, loading = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className={danger ? 'btn-primary' : 'btn-ai'} onClick={onConfirm} disabled={loading}>{confirmLabel}</button></>}>
      {text && <div className="text-sm text-muted">{text}</div>}
    </Modal>
  );
}
