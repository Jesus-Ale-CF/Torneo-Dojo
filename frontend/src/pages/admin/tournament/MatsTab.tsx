import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Users, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { del, post, put } from '@/lib/api';
import type { Mat, Tournament } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { toLocalInput, CATEGORY_STATUS } from '@/lib/format';
import { Modal, Confirm } from '@/components/ui/Modal';
import { Input, Checkbox } from '@/components/ui/Field';
import { ListSkeleton, EmptyState } from '@/components/ui/States';
import { useCategories, useMats, useUsers, invalidateAll } from './shared';

type Row = { categoryId: string; name: string; status: string; matches: number; matId: string; scheduledAt: string; order: number };

export function MatsTab({ t }: { t: Tournament }) {
  const mats = useMats(t.id);
  const cats = useCategories(t.id);
  const users = useUsers();
  const inv = invalidateAll(t.id);
  const [name, setName] = useState('');
  const [assign, setAssign] = useState<Mat | null>(null);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<Mat | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!cats.data || dirty) return;
    setRows([...cats.data].sort((a, b) => a.order - b.order).map((c) => ({ categoryId: c.id, name: c.name, status: c.status, matches: c._count.matches, matId: c.matId ?? '', scheduledAt: toLocalInput(c.scheduledAt), order: c.order })));
  }, [cats.data, dirty]);

  const add = useMut(() => post(`/tournaments/${t.id}/mats`, { name, order: (mats.data?.length ?? 0) + 1, color: ['#c8373b', '#2a63c9', '#2e9e5b', '#ef8a2b', '#7a3fb5'][(mats.data?.length ?? 0) % 5] }), { invalidate: inv, success: 'Tatami creado', onSuccess: () => setName('') });
  const remove = useMut((id: string) => del(`/mats/${id}`), { invalidate: inv, success: 'Tatami eliminado', onSuccess: () => setToDelete(null) });
  const saveUsers = useMut(() => put(`/mats/${assign!.id}/users`, { userIds }), { invalidate: [...inv, ['users']], success: 'Mesas asignadas', onSuccess: () => setAssign(null) });
  const saveSchedule = useMut(() => put(`/tournaments/${t.id}/schedule`, { items: rows.map((r, i) => ({ categoryId: r.categoryId, matId: r.matId || null, scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null, order: i })) }), { invalidate: inv, success: 'Programación guardada', onSuccess: () => setDirty(false) });

  const upd = (i: number, p: Partial<Row>) => { setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x))); setDirty(true); };
  const move = (i: number, d: -1 | 1) => { setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return r; [n[i], n[j]] = [n[j], n[i]]; return n; }); setDirty(true); };
  const tableUsers = useMemo(() => (users.data ?? []).filter((u) => u.role === 'TABLE' && u.active), [users.data]);

  if (mats.isLoading) return <ListSkeleton />;
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-lg">Tatamis</h2>
        <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (name) add.mutate(); }}>
          <Input label="Nuevo tatami" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Tatami ${(mats.data?.length ?? 0) + 1}`} className="flex-1" />
          <div className="flex items-end"><button className="btn-secondary" disabled={!name || add.isPending}><Plus className="h-4 w-4" aria-hidden />Añadir</button></div>
        </form>
        {!mats.data?.length ? <EmptyState title="Sin tatamis" text="Crea al menos un área de combate." /> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mats.data.map((m) => (
              <li key={m.id} className="card obi p-4 pl-5" style={{ '--obi': m.color ?? undefined } as React.CSSProperties}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-base">{m.name}</h3><span className="num text-xs text-muted">{m._count?.matches ?? 0} combates</span></div>
                <p className="mt-1 text-sm text-muted">Mesa: {m.assignments?.length ? m.assignments.map((a) => a.user.name).join(', ') : <span className="text-warn">sin asignar</span>}</p>
                <p className="mt-1 text-xs text-muted">{m.categories?.length ?? 0} categorías programadas</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary text-sm" onClick={() => { setAssign(m); setUserIds(m.assignments?.map((a) => a.user.id) ?? []); }}><Users className="h-4 w-4" aria-hidden />Asignar mesa</button>
                  <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${m.name}`} onClick={() => setToDelete(m)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg">Programación</h2><p className="text-sm text-muted">Asigna cada categoría a un tatami con hora y orden. La cola de combates de cada tatami se recalcula al guardar.</p></div>
          <button className="btn-primary" disabled={!dirty || saveSchedule.isPending} onClick={() => saveSchedule.mutate()}><Save className="h-4 w-4" aria-hidden />Guardar programación</button>
        </div>
        {!rows.length ? <EmptyState title="Sin categorías" /> : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.categoryId} className="card grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[auto_1fr_180px_210px]">
                <div className="flex gap-1"><button className="btn-ghost h-11 w-11 px-0" aria-label={`Subir ${r.name}`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></button><button className="btn-ghost h-11 w-11 px-0" aria-label={`Bajar ${r.name}`} onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown className="h-4 w-4" /></button></div>
                <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="text-xs text-muted">{CATEGORY_STATUS[r.status as keyof typeof CATEGORY_STATUS]} · {r.matches} combates</div></div>
                <label><span className="sr-only">Tatami de {r.name}</span><select className="input" value={r.matId} onChange={(e) => upd(i, { matId: e.target.value })}><option value="">Sin tatami</option>{mats.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                <label><span className="sr-only">Hora de {r.name}</span><input type="datetime-local" className="input" value={r.scheduledAt} onChange={(e) => upd(i, { scheduledAt: e.target.value })} /></label>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Mesa de ${assign?.name}`} size="sm" footer={<><button className="btn-secondary" onClick={() => setAssign(null)}>Cancelar</button><button className="btn-primary" disabled={saveUsers.isPending} onClick={() => saveUsers.mutate()}>Guardar</button></>}>
        {tableUsers.length === 0 ? <p className="text-sm text-muted">No hay usuarios de mesa activos. Créalos en Usuarios.</p> : tableUsers.map((u) => <Checkbox key={u.id} label={u.name} hint={u.email} checked={userIds.includes(u.id)} onChange={(e) => setUserIds(e.target.checked ? [...userIds, u.id] : userIds.filter((x) => x !== u.id))} />)}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar tatami" text={`Sus categorías y combates quedarán sin tatami asignado.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </div>
  );
}
