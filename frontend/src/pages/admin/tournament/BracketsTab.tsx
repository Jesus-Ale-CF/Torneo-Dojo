import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shuffle, ListOrdered, Trash2, RotateCcw, Download, GitBranch } from 'lucide-react';
import { del, downloadFile, get, post } from '@/lib/api';
import type { Bracket as BracketT, Match, Tournament } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { FORMAT, fullName } from '@/lib/format';
import { Confirm } from '@/components/ui/Modal';
import { Checkbox } from '@/components/ui/Field';
import { CategoryBadge, WeighBadge } from '@/components/ui/Badge';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Bracket } from '@/components/Bracket';
import { MatchList } from '@/components/MatchList';
import { Podium } from '@/components/Podium';
import { Standings } from '@/components/Standings';
import { ResultModal } from '@/components/ResultModal';
import { useCategories, invalidateAll } from './shared';

export function BracketsTab({ t }: { t: Tournament }) {
  const cats = useCategories(t.id);
  const [sp, setSp] = useSearchParams();
  const cid = sp.get('c') ?? '';
  useEffect(() => { if (!cid && cats.data?.length) setSp({ c: cats.data[0].id }, { replace: true }); }, [cid, cats.data, setSp]);
  if (cats.isLoading) return <ListSkeleton />;
  if (!cats.data?.length) return <EmptyState title="Sin categorías" text="Crea categorías antes de generar llaves." />;
  return (
    <>
      <label className="mb-6 block max-w-xl"><span className="label mb-1 block">Categoría</span>
        <select className="input" value={cid} onChange={(e) => setSp({ c: e.target.value })}>{cats.data.map((c) => <option key={c.id} value={c.id}>{c.name} · {c._count.registrations} atletas{c.status !== 'OPEN' ? ' · con llave' : ''}</option>)}</select>
      </label>
      {cid && <CategoryBracket key={cid} t={t} cid={cid} />}
    </>
  );
}

function CategoryBracket({ t, cid }: { t: Tournament; cid: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bracket', cid], queryFn: () => get<BracketT>(`/categories/${cid}/bracket`), refetchInterval: 10_000 });
  const [avoid, setAvoid] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState<null | 'regen-random' | 'regen-seed' | 'delete'>(null);
  const [sel, setSel] = useState<Match | null>(null);
  const [resetM, setResetM] = useState<Match | null>(null);
  const inv = invalidateAll(t.id);
  const gen = useMut((manualSeeding: boolean) => post(`/categories/${cid}/bracket/generate`, { manualSeeding, avoidSameAcademy: avoid ?? undefined }), { invalidate: inv, success: 'Llave generada', onSuccess: () => setConfirm(null) });
  const remove = useMut(() => del(`/categories/${cid}/bracket`), { invalidate: inv, success: 'Llave eliminada', onSuccess: () => setConfirm(null) });
  const reset = useMut((id: string) => post(`/matches/${id}/reset`, { reason: 'Anulado por administración' }), { invalidate: inv, success: 'Resultado anulado', onSuccess: () => setResetM(null) });

  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const b = q.data;
  const c = b.category;
  const hasBracket = b.matches.length > 0;
  const started = b.matches.some((m) => m.status === 'IN_PROGRESS' || m.status === 'FINISHED');
  const eligible = c.registrations.filter((r) => r.weighInStatus !== 'DISQUALIFIED');
  const unweighed = c.registrations.filter((r) => r.weighInStatus === 'PENDING' || r.weighInStatus === 'OVERWEIGHT' || r.weighInStatus === 'UNDERWEIGHT');
  const seeded = c.registrations.filter((r) => r.seed != null).length;
  const regs = new Map(c.registrations.map((r) => [r.id, r]));
  const entry = (id: string | null) => (id ? regs.get(id)?.athlete ?? null : null);
  const avoidValue = avoid ?? true;
  const doGen = (seed: boolean) => (hasBracket ? setConfirm(seed ? 'regen-seed' : 'regen-random') : gen.mutate(seed));

  return (
    <div className="space-y-6">
      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg">{c.name}</h2><CategoryBadge status={c.status as never} /></div>
          <p className="text-sm text-muted">{FORMAT[c.format]} · {eligible.length} aptos de {c.registrations.length}{seeded ? ` · ${seeded} sembrados` : ''}{c.mat ? ` · ${c.mat.name}` : ' · sin tatami'}</p>
          {unweighed.length > 0 && <p className="mt-1 text-sm text-warn">{unweighed.length} atleta(s) sin pesaje válido. Se incluirán salvo que se marquen como no aptos.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.format !== 'ROUND_ROBIN' && !started && <Checkbox label="Evitar misma academia" checked={avoidValue} onChange={(e) => setAvoid(e.target.checked)} />}
          {!started && <button className="btn-primary" onClick={() => doGen(false)} disabled={eligible.length < 2 || gen.isPending}><Shuffle className="h-4 w-4" aria-hidden />{hasBracket ? 'Regenerar (sorteo)' : 'Generar por sorteo'}</button>}
          {!started && <button className="btn-secondary" onClick={() => doGen(true)} disabled={eligible.length < 2 || gen.isPending} title="Usa la siembra de la pestaña Inscripciones"><ListOrdered className="h-4 w-4" aria-hidden />Con siembra</button>}
          {hasBracket && !started && <button className="btn-ghost text-shu" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" aria-hidden />Eliminar</button>}
          {hasBracket && <button className="btn-ghost" onClick={() => downloadFile(`/export/categories/${cid}/bracket.pdf`)}><Download className="h-4 w-4" aria-hidden />PDF</button>}
        </div>
      </div>
      {started && <p className="text-sm text-muted">Hay combates iniciados: la llave ya no puede regenerarse. Toca un combate para registrar o corregir su resultado.</p>}

      {!hasBracket ? (
        <div className="space-y-4">
          <EmptyState title="Llave sin generar" text={eligible.length < 2 ? 'Se necesitan al menos 2 atletas aptos.' : 'Elige sorteo aleatorio o siembra manual.'} icon={<GitBranch className="h-6 w-6" aria-hidden />} />
          <ul className="card divide-y divide-line">{c.registrations.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm"><span className="num w-8 text-muted">{r.seed ?? '—'}</span><span className="flex-1">{fullName(r.athlete)}</span><span className="hidden text-muted sm:inline">{r.athlete.academy?.name}</span><WeighBadge status={r.weighInStatus as never} /></li>)}</ul>
        </div>
      ) : (
        <>
          {b.podium.complete && <Podium gold={entry(b.podium.gold)} silver={entry(b.podium.silver)} bronze={b.podium.bronze.map(entry)} />}
          {c.format === 'ROUND_ROBIN' ? <><Standings bracket={b} /><MatchList matches={b.matches} onSelect={(m) => m.status !== 'BYE' && m.redId && m.blueId && setSel(m)} /></> : <Bracket matches={b.matches} onSelect={(m) => m.status !== 'BYE' && m.redId && m.blueId && setSel(m)} />}
          {b.matches.some((m) => m.status === 'FINISHED') && (
            <details className="card p-4"><summary className="cursor-pointer font-semibold">Anular un resultado</summary>
              <ul className="mt-3 space-y-1">{b.matches.filter((m) => m.status === 'FINISHED').map((m) => <li key={m.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{m.label ?? `Ronda ${m.round}`}: {fullName(m.red?.athlete)} vs {fullName(m.blue?.athlete)} · gana {fullName((m.winnerId === m.redId ? m.red : m.blue)?.athlete)}</span><button className="btn-ghost text-sm" onClick={() => setResetM(m)}><RotateCcw className="h-4 w-4" aria-hidden />Anular</button></li>)}</ul>
            </details>
          )}
        </>
      )}
      <ResultModal match={sel} methods={c.tournament.sport.victoryMethods} onClose={() => setSel(null)} onSaved={() => { setSel(null); void qc.invalidateQueries({ queryKey: ['bracket', cid] }); for (const k of inv) void qc.invalidateQueries({ queryKey: k }); }} />
      <Confirm open={confirm === 'regen-random' || confirm === 'regen-seed'} onClose={() => setConfirm(null)} onConfirm={() => gen.mutate(confirm === 'regen-seed')} title="Regenerar llave" text="La llave actual se descartará y se generará una nueva. Ningún combate ha empezado todavía." confirmLabel="Regenerar" loading={gen.isPending} />
      <Confirm open={confirm === 'delete'} onClose={() => setConfirm(null)} onConfirm={() => remove.mutate()} title="Eliminar llave" text="La categoría volverá a estado de inscripción y podrás modificar sus atletas." confirmLabel="Eliminar llave" danger loading={remove.isPending} />
      <Confirm open={!!resetM} onClose={() => setResetM(null)} onConfirm={() => resetM && reset.mutate(resetM.id)} title="Anular resultado" text="El combate volverá a pendiente y los combates posteriores afectados también. Queda registrado en la auditoría." confirmLabel="Anular" danger loading={reset.isPending} />
    </div>
  );
}
