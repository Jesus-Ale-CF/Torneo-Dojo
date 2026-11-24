import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Search, Wand2, Pencil } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api';
import type { Athlete, CategorySuggestion, Registration, Tournament } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { fullName, fmtWeight } from '@/lib/format';
import { Modal, Confirm } from '@/components/ui/Modal';
import { FormErrors, Input, Select } from '@/components/ui/Field';
import { z } from 'zod';
import { WeighBadge } from '@/components/ui/Badge';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, EmptyState } from '@/components/ui/States';
import { useCategories, useRegistrations, invalidateAll } from './shared';

const weightSchema = (key: string) => z.object({ [key]: z.string().refine((v) => !v || (Number(v) > 0 && Number(v) < 400), 'Peso no válido (entre 0 y 400 kg)') });

export function RegistrationsTab({ t }: { t: Tournament }) {
  const regs = useRegistrations(t.id);
  const cats = useCategories(t.id);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Registration | null>(null);
  const [toDelete, setToDelete] = useState<Registration | null>(null);
  const inv = invalidateAll(t.id);

  const filtered = useMemo(() => (regs.data ?? []).filter((r) => {
    if (catFilter === '__none') { if (r.categoryId) return false; } else if (catFilter && r.categoryId !== catFilter) return false;
    const s = q.toLowerCase();
    return !s || `${fullName(r.athlete)} ${r.athlete.document} ${r.athlete.academy?.name ?? ''}`.toLowerCase().includes(s);
  }), [regs.data, q, catFilter]);
  const unassigned = (regs.data ?? []).filter((r) => !r.categoryId).length;

  const remove = useMut((id: string) => del(`/registrations/${id}`), { invalidate: inv, success: 'Inscripción eliminada', onSuccess: () => setToDelete(null) });
  const autoAll = useMut(async () => {
    let n = 0;
    for (const r of (regs.data ?? []).filter((x) => !x.categoryId)) {
      const res = await post<{ registration: Registration }>(`/registrations/${r.id}/auto-assign`);
      if (res.registration.categoryId) n++;
    }
    return n;
  }, { invalidate: inv, onSuccess: () => undefined });

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1"><span className="sr-only">Buscar inscrito</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input className="input pl-9" placeholder="Buscar atleta, documento o academia…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="lg:w-72"><span className="sr-only">Filtrar por categoría</span><select className="input" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}><option value="">Todas las categorías</option><option value="__none">Sin categoría ({unassigned})</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="flex flex-wrap gap-2">
          {unassigned > 0 && <button className="btn-secondary" onClick={() => autoAll.mutate()} disabled={autoAll.isPending}><Wand2 className="h-4 w-4" aria-hidden />Asignar automáticamente</button>}
          <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden />Inscribir</button>
        </div>
      </div>
      {autoAll.data != null && <p className="mb-3 text-sm text-tatami" role="status">Se asignaron {autoAll.data} inscripciones. Las que tienen varias categorías posibles requieren elección manual.</p>}
      {regs.isLoading ? <ListSkeleton /> : !filtered.length ? <EmptyState title="Sin inscripciones" text="Inscribe atletas uno a uno o impórtalos desde Excel en la sección Atletas." /> : (
        <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left"><tr><th className="px-3 py-2.5">Atleta</th><th className="px-3 py-2.5">Categoría</th><th className="hidden px-3 py-2.5 text-right md:table-cell">Peso</th><th className="hidden px-3 py-2.5 text-center sm:table-cell">Siembra</th><th className="px-3 py-2.5">Pesaje</th><th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><span className="font-medium">{fullName(r.athlete)}</span><BeltBadge belt={r.athlete.beltLevel} size="sm" showName={false} /></div><div className="text-xs text-muted">{r.athlete.academy?.name ?? 'Sin academia'}</div></td>
                  <td className="px-3 py-2">{r.category ? <span>{r.category.name}</span> : <span className="font-semibold text-warn">Sin categoría</span>}</td>
                  <td className="num hidden px-3 py-2 text-right md:table-cell">{r.weightKg ?? r.declaredWeight ?? '—'}{(r.weightKg ?? r.declaredWeight) != null && ' kg'}</td>
                  <td className="num hidden px-3 py-2 text-center sm:table-cell">{r.seed ?? '—'}</td>
                  <td className="px-3 py-2"><WeighBadge status={r.weighInStatus} /></td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar inscripción de ${fullName(r.athlete)}`} onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar inscripción de ${fullName(r.athlete)}`} onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AddModal t={t} open={adding} onClose={() => setAdding(false)} registered={new Set((regs.data ?? []).map((r) => r.athleteId))} />
      <EditModal t={t} reg={edit} onClose={() => setEdit(null)} />
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar inscripción" text={`${fullName(toDelete?.athlete)} dejará de estar inscrito en este torneo.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </>
  );
}

function AddModal({ t, open, onClose, registered }: { t: Tournament; open: boolean; onClose: () => void; registered: Set<string> }) {
  const athletes = useQuery({ queryKey: ['athletes'], queryFn: () => get<Athlete[]>('/athletes'), enabled: open });
  const cats = useCategories(t.id);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Athlete | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [weight, setWeight] = useState('');
  const list = (athletes.data ?? []).filter((a) => !registered.has(a.id) && (!q || `${a.firstName} ${a.lastName} ${a.document}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 30);
  const close = () => { setSel(null); setQ(''); setCategoryId(''); setWeight(''); add.reset(); onClose(); };
  const add = useMut((_: { declaredWeight: string }) => post<Registration>(`/tournaments/${t.id}/registrations`, { athleteId: sel!.id, categoryId: categoryId || null, declaredWeight: weight ? Number(weight) : null, autoAssign: true }), {
    invalidate: invalidateAll(t.id), onSuccess: () => close(), success: 'Atleta inscrito', schema: weightSchema('declaredWeight'),
  });
  return (
    <Modal open={open} onClose={close} title="Inscribir atleta" size="lg" footer={<><button className="btn-secondary" onClick={close}>Cancelar</button><button className="btn-primary" disabled={!sel || add.isPending} onClick={() => add.mutate({ declaredWeight: weight })}>Inscribir</button></>}>
      {!sel ? (
        <div className="space-y-3">
          <Input label="Buscar atleta" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento" />
          <ul className="max-h-80 divide-y divide-line overflow-auto rounded-lg border border-line">
            {list.map((a) => <li key={a.id}><button className="flex w-full min-h-touch items-center gap-3 px-3 py-2 text-left hover:bg-elevated" onClick={() => setSel(a)}><span className="flex-1"><span className="font-medium">{a.lastName}, {a.firstName}</span><span className="block text-xs text-muted">{a.document} · {a.academy?.name ?? 'Sin academia'}</span></span><BeltBadge belt={a.beltLevel} size="sm" /></button></li>)}
            {athletes.isLoading && <li className="p-3 text-sm text-muted">Cargando…</li>}
            {!athletes.isLoading && list.length === 0 && <li className="p-3 text-sm text-muted">No hay atletas disponibles. Créalos en la sección Atletas.</li>}
          </ul>
        </div>
      ) : (
        <FormErrors errors={add.fieldErrors}><div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-elevated p-3"><span><strong>{sel.firstName} {sel.lastName}</strong><span className="block text-xs text-muted">{sel.academy?.name}</span></span><button className="btn-ghost text-sm" onClick={() => setSel(null)}>Cambiar</button></div>
          <Input label="Peso declarado (kg)" name="declaredWeight" type="number" inputMode="decimal" step="0.1" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} hint="Ayuda a elegir la división de peso" />
          <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} hint="Vacío = asignación automática si hay una única categoría compatible"><option value="">Automática</option>{cats.data?.filter((c) => c.status === 'OPEN').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div></FormErrors>
      )}
    </Modal>
  );
}

function EditModal({ t, reg, onClose }: { t: Tournament; reg: Registration | null; onClose: () => void }) {
  const cats = useCategories(t.id);
  const sugg = useQuery({ queryKey: ['suggestions', reg?.id], queryFn: () => get<CategorySuggestion[]>(`/registrations/${reg!.id}/suggestions`), enabled: !!reg });
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [seed, setSeed] = useState<string | undefined>();
  const cur = reg ? { categoryId: categoryId ?? reg.categoryId ?? '', seed: seed ?? reg.seed?.toString() ?? '' } : null;
  const close = () => { setCategoryId(undefined); setSeed(undefined); save.reset(); onClose(); };
  const save = useMut((_: { seed: string }) => patch(`/registrations/${reg!.id}`, { categoryId: cur!.categoryId || null, seed: cur!.seed ? Number(cur!.seed) : null }), { invalidate: invalidateAll(t.id), success: 'Inscripción actualizada', onSuccess: () => close(), schema: z.object({ seed: z.string().refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1), 'Debe ser un número entero mayor o igual que 1') }) });
  return (
    <Modal open={!!reg} onClose={close} title={`Inscripción de ${fullName(reg?.athlete)}`} footer={<><button className="btn-secondary" onClick={close}>Cancelar</button><button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate({ seed: cur?.seed ?? '' })}>Guardar</button></>}>
      {reg && cur && (
        <FormErrors errors={save.fieldErrors}><div className="space-y-4">
          {sugg.data && sugg.data.length > 0 && (
            <div><p className="label mb-2">Categorías compatibles</p><div className="flex flex-wrap gap-2">{sugg.data.map((s) => <button key={s.id} type="button" aria-pressed={cur.categoryId === s.id} onClick={() => setCategoryId(s.id)} className={`btn h-auto min-h-touch border px-3 py-1.5 text-left text-sm ${cur.categoryId === s.id ? 'border-shu bg-shu/10' : 'border-line bg-surface'}`}><span>{s.name}<span className="block text-xs text-muted">{fmtWeight(s.weightDivision)} · {s._count.registrations} inscritos</span></span></button>)}</div></div>
          )}
          <Select label="Categoría" value={cur.categoryId} onChange={(e) => setCategoryId(e.target.value)} hint="Solo categorías sin llave generada"><option value="">Sin categoría</option>{cats.data?.filter((c) => c.status === 'OPEN' || c.id === reg.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Input label="Siembra (1 = mejor)" name="seed" type="number" inputMode="numeric" min={1} value={cur.seed} onChange={(e) => setSeed(e.target.value)} hint="Se usa al generar la llave con siembra manual" />
        </div></FormErrors>
      )}
    </Modal>
  );
}
