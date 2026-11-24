import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Check, Undo2, ChevronRight, History, Trophy } from 'lucide-react';
import { get, post } from '@/lib/api';
import type { Match, Mat, PublicTournament, Tournament, VictoryMethod } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useMut } from '@/lib/hooks';
import { fullName, roundName, fmtDateTime } from '@/lib/format';
import { fadeUp, stagger } from '@/lib/motion';
import { PageHeader } from '@/components/ui/Page';
import { ResultModal } from '@/components/ResultModal';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { MatchBadge } from '@/components/ui/Badge';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';

/** Mesa de control: diseñada para tablet. Botones grandes, 1–2 pulsaciones por resultado. */
export function TablePage() {
  const { user } = useAuth();
  const { matId } = useParams();
  const nav = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  // Admin: puede elegir cualquier tatami de cualquier torneo. Mesa: solo los asignados.
  const tours = useQuery({ queryKey: ['tournaments'], queryFn: () => get<Tournament[]>('/tournaments'), enabled: isAdmin });
  const [tid, setTid] = useState('');
  useEffect(() => { if (isAdmin && !tid && tours.data?.length) setTid(tours.data.find((t) => t.status === 'IN_PROGRESS')?.id ?? tours.data[0].id); }, [isAdmin, tid, tours.data]);
  const adminMats = useQuery({ queryKey: ['mats', tid], queryFn: () => get<Mat[]>(`/tournaments/${tid}/mats`), enabled: isAdmin && !!tid });
  const mats: { id: string; name: string; tournamentId: string; tournamentName?: string }[] = isAdmin ? (adminMats.data ?? []).map((m) => ({ id: m.id, name: m.name, tournamentId: tid })) : (user?.mats ?? []);

  if (!matId) {
    return (
      <>
        <PageHeader eyebrow="Mesa de control" title="Selecciona tu tatami" subtitle={isAdmin ? 'Como administrador puedes operar cualquier tatami.' : 'Solo verás los tatamis que tienes asignados.'} />
        {isAdmin && tours.data && <label className="mb-4 block max-w-sm"><span className="label mb-1 block">Torneo</span><select className="input" value={tid} onChange={(e) => setTid(e.target.value)}>{tours.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        {mats.length === 0 ? <EmptyState title="Sin tatamis asignados" text="Pide a la organización que te asigne un tatami." /> : (
          <motion.ul variants={stagger()} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mats.map((m) => <motion.li key={m.id} variants={fadeUp}><Link to={`/mesa/${m.id}`} className="card obi flex min-h-[96px] items-center justify-between p-5 pl-6 transition-shadow hover:shadow-lift"><span><span className="block text-xl font-bold">{m.name}</span>{m.tournamentName && <span className="text-sm text-muted">{m.tournamentName}</span>}</span><ChevronRight className="h-6 w-6 text-muted" aria-hidden /></Link></motion.li>)}
          </motion.ul>
        )}
      </>
    );
  }
  return <MatConsole matId={matId} onBack={() => nav('/mesa')} />;
}

function MatConsole({ matId, onBack }: { matId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['mat-matches', matId], queryFn: () => get<Match[]>(`/mats/${matId}/matches`), refetchInterval: 8000 });
  const tournamentId = q.data?.[0]?.category.tournamentId;
  const tour = useQuery({ queryKey: ['public', 'tournament', tournamentId], queryFn: () => get<PublicTournament>(`/public/tournaments/${tournamentId}`), enabled: !!tournamentId });
  const methods: VictoryMethod[] = tour.data?.sport.victoryMethods ?? [];
  const [selected, setSelected] = useState<Match | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inv = () => { void qc.invalidateQueries({ queryKey: ['mat-matches', matId] }); void qc.invalidateQueries({ queryKey: ['live'] }); void qc.invalidateQueries({ queryKey: ['public'] }); void qc.invalidateQueries({ queryKey: ['medals'] }); };
  const start = useMut((id: string) => post<Match>(`/matches/${id}/start`), { success: 'Combate iniciado', onSuccess: () => inv() });
  const cancelStart = useMut((id: string) => post<Match>(`/matches/${id}/cancel-start`), { onSuccess: () => { inv(); setSelected(null); } });

  const matches = q.data ?? [];
  const current = matches.find((m) => m.status === 'IN_PROGRESS') ?? null;
  const ready = useMemo(() => matches.filter((m) => m.status === 'PENDING' && m.redId && m.blueId), [matches]);
  const waiting = useMemo(() => matches.filter((m) => m.status === 'PENDING' && (!m.redId || !m.blueId)), [matches]);
  const done = useMemo(() => matches.filter((m) => m.status === 'FINISHED').slice().reverse(), [matches]);
  const matName = user?.mats.find((m) => m.id === matId)?.name ?? current?.mat?.name ?? matches[0]?.mat?.name ?? 'Tatami';

  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;

  return (
    <>
      <PageHeader eyebrow={<button onClick={onBack} className="hover:underline">← Cambiar tatami</button>} title={matName} subtitle={<span><span className="num">{ready.length}</span> listos · <span className="num">{waiting.length}</span> esperando rival · <span className="num">{done.length}</span> finalizados</span>}
        actions={<button className="btn-secondary" onClick={() => setShowDone((v) => !v)} aria-pressed={showDone}><History className="h-4 w-4" aria-hidden />{showDone ? 'Ocultar finalizados' : 'Finalizados'}</button>} />

      <p className="mb-6 text-sm text-muted">Cómo funciona: pulsa <strong className="text-ink">Iniciar</strong> en el siguiente combate de la cola y, cuando termine, <strong className="text-ink">Registrar ganador</strong>. Si te equivocas, ábrelo desde <strong className="text-ink">Finalizados</strong> y corrígelo.</p>

      {/* Combate en curso */}
      <section aria-labelledby="actual-h" className="mb-8">
        <h2 id="actual-h" className="label mb-2">Combate en curso</h2>
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card border-tatami/60 ring-2 ring-tatami/40">
              <BigMatch m={current} />
              <div className="flex flex-wrap gap-2 border-t border-line p-4">
                <button className="btn-primary min-h-[56px] flex-1 text-lg" onClick={() => setSelected(current)}><Trophy className="h-5 w-5" aria-hidden />Registrar ganador</button>
                <button className="btn-secondary min-h-[56px]" onClick={() => cancelStart.mutate(current.id)} disabled={cancelStart.isPending}><Undo2 className="h-5 w-5" aria-hidden />No iniciado</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card border-dashed p-6 text-center text-muted">Ningún combate en curso. Inicia el siguiente de la cola.</motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Cola */}
      <section aria-labelledby="cola-h" className="mb-8">
        <h2 id="cola-h" className="label mb-2">Siguientes combates</h2>
        {ready.length === 0 && waiting.length === 0 ? <EmptyState title="Cola vacía" text="No quedan combates programados en este tatami." /> : (
          <motion.ol variants={stagger(0.03)} initial="hidden" animate="show" className="space-y-2">
            {ready.map((m, i) => (
              <motion.li key={m.id} variants={fadeUp} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <span className="num hidden w-10 text-center text-lg font-bold text-muted sm:block">#{m.matOrder ?? i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-muted">{m.category.name} · {roundName(m)}</div>
                  <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Corner m={m} side="red" /><span className="font-display text-xs font-black text-muted">VS</span><Corner m={m} side="blue" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-tatami min-h-[52px] flex-1 sm:flex-none" onClick={() => start.mutate(m.id)} disabled={!!current || start.isPending} title={current ? 'Finaliza el combate en curso primero' : undefined}><Play className="h-5 w-5" aria-hidden />Iniciar</button>
                  <button className="btn-secondary min-h-[52px]" onClick={() => setSelected(m)} aria-label="Registrar resultado sin iniciar"><Check className="h-5 w-5" aria-hidden /><span className="hidden lg:inline">Resultado</span></button>
                </div>
              </motion.li>
            ))}
            {waiting.map((m) => (
              <li key={m.id} className="card flex items-center gap-3 border-dashed bg-elevated/50 p-3">
                <span className="num hidden w-10 text-center text-lg font-bold text-muted sm:block">#{m.matOrder ?? '·'}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-xs text-muted">{m.category.name} · {roundName(m)}</div><div className="text-sm">{fullName(m.red?.athlete)} <span className="text-muted">vs</span> {fullName(m.blue?.athlete)}</div></div>
                <MatchBadge status="PENDING" />
              </li>
            ))}
          </motion.ol>
        )}
      </section>

      {showDone && (
        <section aria-labelledby="done-h">
          <h2 id="done-h" className="label mb-2">Finalizados (toca para corregir)</h2>
          <ul className="space-y-2">
            {done.map((m) => (
              <li key={m.id}><button onClick={() => setSelected(m)} className="card flex w-full items-center gap-3 p-3 text-left hover:shadow-lift">
                <div className="min-w-0 flex-1"><div className="truncate text-xs text-muted">{m.category.name} · {roundName(m)}</div><div className="text-sm"><Trophy className="mr-1 inline h-3.5 w-3.5 text-gold" aria-hidden /><strong>{fullName((m.winnerId === m.redId ? m.red : m.blue)?.athlete)}</strong> <span className="text-muted">venció a</span> {fullName((m.winnerId === m.redId ? m.blue : m.red)?.athlete)} <span className="text-muted">· {m.victoryMethod?.name}</span></div></div>
                <span className="text-xs text-muted">{fmtDateTime(m.finishedAt)}</span>
              </button></li>
            ))}
            {done.length === 0 && <li className="text-sm text-muted">Aún no hay combates finalizados.</li>}
          </ul>
        </section>
      )}

      <ResultModal match={selected} methods={methods} onClose={() => setSelected(null)} onSaved={() => { inv(); setSelected(null); }} />
    </>
  );
}

function Corner({ m, side }: { m: Match; side: 'red' | 'blue' }) {
  const reg = side === 'red' ? m.red : m.blue;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${side === 'blue' ? 'flex-row-reverse text-right' : ''}`}>
      <span className={`h-8 w-1.5 shrink-0 rounded-full ${side === 'red' ? 'bg-shu' : 'bg-ai'}`} aria-hidden />
      <div className="min-w-0"><div className="truncate font-semibold"><span className="sr-only">{side === 'red' ? 'Rojo' : 'Azul'}: </span>{fullName(reg?.athlete)}</div><div className="truncate text-xs text-muted">{reg?.athlete.academy?.name}</div></div>
    </div>
  );
}

function BigMatch({ m }: { m: Match }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-muted"><span className="truncate">{m.category.name} · {roundName(m)}</span>{m.matOrder && <span className="num">#{m.matOrder}</span>}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {(['red', 'blue'] as const).map((side, i) => { const reg = side === 'red' ? m.red : m.blue; return (
          <div key={side} className={`${i === 1 ? 'order-3 text-right' : ''} min-w-0`}>
            <span className={`label ${side === 'red' ? 'text-shu' : 'text-ai'}`}>{side === 'red' ? 'Rojo' : 'Azul'}</span>
            <div className="truncate text-xl font-bold sm:text-2xl">{fullName(reg?.athlete)}</div>
            <div className={`mt-1 flex items-center gap-2 text-sm text-muted ${i === 1 ? 'justify-end' : ''}`}><span className="truncate">{reg?.athlete.academy?.name}</span><BeltBadge belt={reg?.athlete.beltLevel} size="sm" showName={false} /></div>
          </div>); })}
        <span className="order-2 font-display text-lg font-black text-muted">VS</span>
      </div>
    </div>
  );
}

