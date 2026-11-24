import { useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Scale, Ban, ArrowRight, CheckCircle2 } from 'lucide-react';
import { patch, post } from '@/lib/api';
import type { CategorySuggestion, Registration, Tournament, WeighInStatus } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { fullName, fmtWeight, WEIGH } from '@/lib/format';
import { WeighBadge } from '@/components/ui/Badge';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, EmptyState } from '@/components/ui/States';
import { useRegistrations, invalidateAll } from './shared';

type Res = { registration: Registration; status: WeighInStatus; suggestions: CategorySuggestion[] };

/** Pesaje pensado para tablet: busca, escribe el peso, Enter. */
export function WeighInTab({ t }: { t: Tournament }) {
  const regs = useRegistrations(t.id);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | WeighInStatus>('');
  const [active, setActive] = useState<string | null>(null);
  const [last, setLast] = useState<Res | null>(null);
  const list = useMemo(() => (regs.data ?? []).filter((r) => (!status || r.weighInStatus === status) && (!q || `${fullName(r.athlete)} ${r.athlete.document}`.toLowerCase().includes(q.toLowerCase()))), [regs.data, q, status]);
  const counts = (regs.data ?? []).reduce<Record<string, number>>((a, r) => ((a[r.weighInStatus] = (a[r.weighInStatus] ?? 0) + 1), a), {});
  const inv = invalidateAll(t.id);
  const weigh = useMut((p: { id: string; weightKg: number }) => post<Res>(`/registrations/${p.id}/weigh-in`, { weightKg: p.weightKg }), { invalidate: inv, onSuccess: (r) => { setLast(r); if (r.status === 'OK') setActive(null); } });
  const move = useMut((p: { id: string; categoryId: string }) => patch(`/registrations/${p.id}`, { categoryId: p.categoryId }), { invalidate: inv, success: 'Atleta movido de categoría', onSuccess: () => { setLast(null); setActive(null); } });
  const dq = useMut((id: string) => post(`/registrations/${id}/disqualify`, { notes: 'No dio el peso' }), { invalidate: inv, success: 'Atleta marcado como no apto', onSuccess: () => { setLast(null); setActive(null); } });

  return (
    <>
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar por estado">
        {(['', 'PENDING', 'OK', 'OVERWEIGHT', 'UNDERWEIGHT', 'DISQUALIFIED'] as const).map((s) => (
          <li key={s || 'all'}><button aria-pressed={status === s} onClick={() => setStatus(s)} className={`btn h-10 min-h-touch border px-3 text-sm ${status === s ? 'border-shu bg-shu/10 text-shu' : 'border-line bg-surface text-muted'}`}>{s ? WEIGH[s] : 'Todos'} <span className="num">{s ? counts[s] ?? 0 : regs.data?.length ?? 0}</span></button></li>
        ))}
      </ul>
      <label className="relative mb-4 block"><span className="sr-only">Buscar atleta</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input className="input pl-9 text-lg" placeholder="Buscar por nombre o documento…" value={q} onChange={(e) => setQ(e.target.value)} /></label>

      <AnimatePresence>
        {last && last.status !== 'OK' && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card mb-4 border-warn/60 p-4" role="alert">
            <p className="font-semibold"><span className="text-warn">{WEIGH[last.status]}:</span> {fullName(last.registration.athlete)} pesó <span className="num">{last.registration.weightKg} kg</span>{last.registration.category?.weightDivision && <> (límite {fmtWeight(last.registration.category.weightDivision)})</>}.</p>
            <p className="mt-2 text-sm text-muted">{last.suggestions.length ? 'Puedes moverlo a una categoría compatible con su peso:' : 'No hay ninguna categoría abierta compatible con este peso.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {last.suggestions.map((s) => <button key={s.id} className="btn-ai text-sm" onClick={() => move.mutate({ id: last.registration.id, categoryId: s.id })}><ArrowRight className="h-4 w-4" aria-hidden />{s.name}</button>)}
              <button className="btn-secondary text-sm text-shu" onClick={() => dq.mutate(last.registration.id)}><Ban className="h-4 w-4" aria-hidden />Marcar no apto</button>
              <button className="btn-ghost text-sm" onClick={() => setLast(null)}>Decidir después</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {regs.isLoading ? <ListSkeleton /> : !list.length ? <EmptyState title="Sin atletas" text="No hay inscritos con este filtro." /> : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className={`card p-3 ${active === r.id ? 'ring-2 ring-ai' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <div className="flex items-center gap-2"><span className="font-semibold">{fullName(r.athlete)}</span><BeltBadge belt={r.athlete.beltLevel} size="sm" showName={false} /></div>
                  <div className="text-xs text-muted">{r.category?.name ?? 'Sin categoría'}{r.category?.weightDivision && ` · ${fmtWeight(r.category.weightDivision)}`}</div>
                </div>
                <span className="num text-sm">{r.weightKg != null ? `${r.weightKg} kg` : r.declaredWeight != null ? <span className="text-muted">decl. {r.declaredWeight} kg</span> : ''}</span>
                <WeighBadge status={r.weighInStatus} />
                {active !== r.id && <button className="btn-secondary" onClick={() => setActive(r.id)} disabled={r.category?.status !== undefined && r.category.status !== 'OPEN'} title={r.category && r.category.status !== 'OPEN' ? 'La categoría ya tiene llave' : undefined}><Scale className="h-4 w-4" aria-hidden />Pesar</button>}
              </div>
              {active === r.id && <WeighForm initial={r.weightKg ?? r.declaredWeight} busy={weigh.isPending} onCancel={() => setActive(null)} onSubmit={(w) => weigh.mutate({ id: r.id, weightKg: w })} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WeighForm({ initial, onSubmit, onCancel, busy }: { initial: number | null; onSubmit: (w: number) => void; onCancel: () => void; busy: boolean }) {
  const [v, setV] = useState(initial?.toString() ?? '');
  const n = Number(v.replace(',', '.'));
  const valid = v !== '' && Number.isFinite(n) && n > 0 && n < 400;
  const submit = (e: FormEvent) => { e.preventDefault(); if (valid) onSubmit(n); };
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <label className="flex-1 min-w-[160px]"><span className="label mb-1 block">Peso real (kg)</span><input autoFocus inputMode="decimal" className="input num h-14 text-2xl font-bold" value={v} onChange={(e) => setV(e.target.value)} aria-invalid={v !== '' && !valid} /></label>
      <button className="btn-tatami h-14" disabled={!valid || busy}><CheckCircle2 className="h-5 w-5" aria-hidden />Registrar</button>
      <button type="button" className="btn-ghost h-14" onClick={onCancel}>Cancelar</button>
    </form>
  );
}
