import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, AlertTriangle } from 'lucide-react';
import { get, post } from '@/lib/api';
import type { Audit, Match, VictoryMethod } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { fullName, roundName, fmtDateTime } from '@/lib/format';
import { Modal } from './ui/Modal';
import { Textarea } from './ui/Field';

/** Dos pulsaciones: ganador → método → guardar (el método se guarda al pulsar). */
export function ResultModal({ match, methods, onClose, onSaved }: { match: Match | null; methods: VictoryMethod[]; onClose: () => void; onSaved: () => void }) {
  const [winner, setWinner] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const correcting = match?.status === 'FINISHED';
  const audit = useQuery({ queryKey: ['audit', match?.id], queryFn: () => get<Audit[]>(`/matches/${match!.id}/audit`), enabled: !!match && correcting });
  useEffect(() => { setWinner(match?.winnerId ?? null); setReason(''); setSaved(false); }, [match]);
  const save = useMut((p: { winnerId: string; victoryMethodId: string; reason?: string }) => post<Match>(`/matches/${match!.id}/result`, p), { success: correcting ? 'Resultado corregido' : 'Resultado guardado', onSuccess: () => { setSaved(true); setTimeout(onSaved, 500); } });
  if (!match) return null;
  const pick = (side: 'red' | 'blue') => setWinner(side === 'red' ? match.redId : match.blueId);
  const w = winner === match.redId ? match.red : winner === match.blueId ? match.blue : null;
  return (
    <Modal open={!!match} onClose={onClose} title={correcting ? 'Corregir resultado' : 'Registrar resultado'} size="lg">
      <div className="mb-4 text-sm text-muted">{match.category.name} · {roundName(match)}</div>
      {correcting && <div className="mb-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><p>Este combate ya tiene resultado. Al corregirlo se recalculará el avance en la llave y los combates posteriores afectados volverán a pendiente. La corrección queda registrada.</p></div>}
      <p className="label mb-2">1. ¿Quién ganó?</p>
      <div className="grid grid-cols-2 gap-3">
        {(['red', 'blue'] as const).map((side) => { const reg = side === 'red' ? match.red : match.blue; const active = winner != null && winner === (side === 'red' ? match.redId : match.blueId); return (
          <button key={side} onClick={() => pick(side)} aria-pressed={active}
            className={`relative flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-dojo border-2 p-3 text-center transition-all ${active ? (side === 'red' ? 'border-shu bg-shu/10 shadow-lift' : 'border-ai bg-ai/10 shadow-lift') : 'border-line bg-surface hover:bg-elevated'}`}>
            <span className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r ${side === 'red' ? 'bg-shu' : 'bg-ai'}`} aria-hidden />
            <span className={`label ${side === 'red' ? 'text-shu' : 'text-ai'}`}>{side === 'red' ? 'Rojo' : 'Azul'}</span>
            <span className="text-lg font-bold leading-tight sm:text-xl">{fullName(reg?.athlete)}</span>
            <span className="text-xs text-muted">{reg?.athlete.academy?.name}</span>
            {active && <motion.span layoutId="win-check" className={`absolute right-2 top-2 rounded-full p-1 text-on-accent ${side === 'red' ? 'bg-shu' : 'bg-ai'}`}><Check className="h-4 w-4" aria-hidden /></motion.span>}
          </button>); })}
      </div>
      <AnimatePresence>
        {winner && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="label mb-2 mt-5">2. Método de victoria de {fullName(w?.athlete)}</p>
            {correcting && <Textarea label="Motivo de la corrección" value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3" placeholder="Ej.: error al registrar la esquina" />}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {methods.map((me) => (
                <button key={me.id} disabled={save.isPending || saved || (correcting && !reason.trim())} onClick={() => save.mutate({ winnerId: winner, victoryMethodId: me.id, reason: reason || undefined })}
                  className={`btn min-h-[64px] flex-col gap-0 border text-base ${match.victoryMethodId === me.id && winner === match.winnerId ? 'border-gold bg-gold/10' : 'border-line bg-surface hover:bg-elevated'}`}>
                  <span className="font-bold">{me.name}</span><span className="num text-[10px] text-muted">{me.code}</span>
                </button>
              ))}
            </div>
            {correcting && !reason.trim() && <p className="mt-2 text-xs text-muted">Indica un motivo para habilitar los métodos.</p>}
            <AnimatePresence>{saved && <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 flex items-center justify-center gap-2 text-tatami font-semibold" role="status"><Check className="h-5 w-5" aria-hidden />Guardado</motion.p>}</AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      {correcting && audit.data && audit.data.length > 0 && (
        <details className="mt-6 text-sm"><summary className="cursor-pointer font-semibold">Historial de cambios ({audit.data.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">{audit.data.map((a) => <li key={a.id}>{fmtDateTime(a.createdAt)} · {a.user?.name ?? 'Sistema'} · {a.previousStatus ?? '—'} → {a.newStatus ?? '—'}{a.reason ? ` · "${a.reason}"` : ''}</li>)}</ul>
        </details>
      )}
    </Modal>
  );
}
