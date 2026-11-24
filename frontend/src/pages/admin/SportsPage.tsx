import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { del, get, post, put } from '@/lib/api';
import type { Sport } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { useFieldError } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { Modal, Confirm } from '@/components/ui/Modal';
import { FormErrors, InlineInput, Input, Textarea } from '@/components/ui/Field';
import { sportSchema } from '@/lib/validation';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, ErrorState } from '@/components/ui/States';

type Method = { id?: string; code: string; name: string; order: number; points: number };
type Belt = { id?: string; name: string; color: string; secondary: string | null; order: number };
type Form = { name: string; defaultDurationSec: number; description: string; victoryMethods: Method[]; beltLevels: Belt[] };
const empty: Form = { name: '', defaultDurationSec: 300, description: '', victoryMethods: [{ code: 'POINTS', name: 'Puntos', order: 1, points: 1 }], beltLevels: [{ name: 'Blanco', color: '#f5f5f0', secondary: null, order: 1 }] };

export function SportsPage() {
  const q = useQuery({ queryKey: ['sports'], queryFn: () => get<Sport[]>('/sports') });
  const [editing, setEditing] = useState<(Form & { id?: string }) | null>(null);
  const [toDelete, setToDelete] = useState<Sport | null>(null);
  const save = useMut((f: Form & { id?: string }) => { const { id, ...body } = f; return id ? put(`/sports/${id}`, body) : post('/sports', body); }, { invalidate: [['sports']], success: 'Deporte guardado', onSuccess: () => close(), schema: sportSchema });
  const close = () => { setEditing(null); save.reset(); };
  const remove = useMut((id: string) => del(`/sports/${id}`), { invalidate: [['sports']], success: 'Deporte eliminado', onSuccess: () => setToDelete(null) });

  return (
    <>
      <PageHeader title="Deportes" subtitle="Cada deporte define sus métodos de victoria, duración de combate y cinturones o niveles." actions={<button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" aria-hidden />Nuevo deporte</button>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((s) => (
            <li key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-lg">{s.name}</h2><p className="text-sm text-muted">{Math.round(s.defaultDurationSec / 60)} min por combate · {s._count?.tournaments ?? 0} torneos</p></div>
                <div className="flex gap-1">
                  <button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar ${s.name}`} onClick={() => setEditing({ id: s.id, name: s.name, defaultDurationSec: s.defaultDurationSec, description: s.description ?? '', victoryMethods: s.victoryMethods.map((m) => ({ id: m.id, code: m.code, name: m.name, order: m.order ?? 0, points: m.points ?? 1 })), beltLevels: s.beltLevels.map((b) => ({ id: b.id, name: b.name, color: b.color, secondary: b.secondary, order: b.order ?? 0 })) })}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${s.name}`} onClick={() => setToDelete(s)} disabled={!!s._count?.tournaments}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4"><p className="label mb-1.5">Métodos de victoria</p><ul className="flex flex-wrap gap-1.5">{s.victoryMethods.map((m) => <li key={m.id} className="rounded-md bg-elevated px-2 py-0.5 text-xs font-medium">{m.name} <span className="num text-muted">({m.points} pt)</span></li>)}</ul></div>
              <div className="mt-4"><p className="label mb-1.5">Cinturones</p><ul className="flex flex-wrap gap-x-4 gap-y-1.5">{s.beltLevels.map((b) => <li key={b.id}><BeltBadge belt={b} size="sm" /></li>)}</ul></div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={close} title={editing?.id ? 'Editar deporte' : 'Nuevo deporte'} size="lg"
        footer={<><button type="button" className="btn-secondary" onClick={close}>Cancelar</button><button type="submit" form="form-deporte" className="btn-primary" disabled={save.isPending}>Guardar</button></>}>
        {editing && (
          <form id="form-deporte" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}><FormErrors errors={save.fieldErrors}>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Nombre" name="name" maxLength={60} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              <Input label="Duración por defecto (segundos)" name="defaultDurationSec" type="number" inputMode="numeric" min={30} max={3600} value={Number.isNaN(editing.defaultDurationSec) ? '' : editing.defaultDurationSec} onChange={(e) => setEditing({ ...editing, defaultDurationSec: e.target.valueAsNumber })} />
            </div>
            <Textarea label="Descripción" name="description" maxLength={1000} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <fieldset>
              <legend className="label mb-2">Métodos de victoria</legend>
              <div className="space-y-2">
                {editing.victoryMethods.map((m, i) => (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_72px_auto] items-start gap-2">
                    <GripVertical className="mt-3.5 h-4 w-4 text-muted" aria-hidden />
                    <InlineInput name={`victoryMethods.${i}.code`} aria-label={`Código del método ${i + 1}`} placeholder="CÓDIGO" maxLength={20} value={m.code} onChange={(e) => upd(i, { code: e.target.value.toUpperCase() })} />
                    <InlineInput name={`victoryMethods.${i}.name`} aria-label={`Nombre del método ${i + 1}`} placeholder="Nombre" maxLength={60} value={m.name} onChange={(e) => upd(i, { name: e.target.value })} />
                    <InlineInput name={`victoryMethods.${i}.points`} aria-label={`Puntos de desempate del método ${i + 1}`} type="number" inputMode="numeric" min={0} max={100} value={Number.isNaN(m.points) ? '' : m.points} onChange={(e) => upd(i, { points: e.target.valueAsNumber })} />
                    <button type="button" className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Quitar método ${i + 1}`} onClick={() => setEditing({ ...editing, victoryMethods: editing.victoryMethods.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" className="btn-secondary text-sm" onClick={() => setEditing({ ...editing, victoryMethods: [...editing.victoryMethods, { code: '', name: '', order: editing.victoryMethods.length + 1, points: 1 }] })}><Plus className="h-4 w-4" aria-hidden />Añadir método</button>
              </div>
              <p className="mt-1 text-xs text-muted">Los puntos se usan como criterio de desempate en round robin.</p>
              <FieldMsg name="victoryMethods" />
            </fieldset>
            <fieldset>
              <legend className="label mb-2">Cinturones / niveles</legend>
              <div className="space-y-2">
                {editing.beltLevels.map((b, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-start gap-2">
                    <InlineInput name={`beltLevels.${i}.name`} aria-label={`Nombre del cinturón ${i + 1}`} placeholder="Nombre" maxLength={40} value={b.name} onChange={(e) => updB(i, { name: e.target.value })} />
                    <label className="flex items-center gap-1 text-xs"><span className="sr-only">Color del cinturón {i + 1}</span><input type="color" className="h-11 w-11 cursor-pointer rounded-lg border border-line bg-surface" value={b.color} onChange={(e) => updB(i, { color: e.target.value })} /></label>
                    <label className="flex items-center gap-1 text-xs" title="Franja secundaria (opcional)"><span className="sr-only">Color secundario del cinturón {i + 1}</span><input type="color" className="h-11 w-11 cursor-pointer rounded-lg border border-line bg-surface" value={b.secondary ?? '#ffffff'} onChange={(e) => updB(i, { secondary: e.target.value })} /><button type="button" className="min-h-touch px-2 text-muted underline" aria-label={`Sin franja, cinturón ${i + 1}`} onClick={() => updB(i, { secondary: null })}>Sin franja</button></label>
                    <button type="button" className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Quitar cinturón ${i + 1}`} onClick={() => setEditing({ ...editing, beltLevels: editing.beltLevels.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" className="btn-secondary text-sm" onClick={() => setEditing({ ...editing, beltLevels: [...editing.beltLevels, { name: '', color: '#2a63c9', secondary: null, order: editing.beltLevels.length + 1 }] })}><Plus className="h-4 w-4" aria-hidden />Añadir cinturón</button>
              </div>
            </fieldset>
          </div>
          </FormErrors></form>
        )}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar deporte" text={`Se eliminará "${toDelete?.name}" con sus métodos y cinturones.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </>
  );
  function upd(i: number, p: Partial<Method>) { if (!editing) return; const v = [...editing.victoryMethods]; v[i] = { ...v[i], ...p }; setEditing({ ...editing, victoryMethods: v }); }
  function updB(i: number, p: Partial<Belt>) { if (!editing) return; const v = [...editing.beltLevels]; v[i] = { ...v[i], ...p }; setEditing({ ...editing, beltLevels: v }); }
}

/** Error de una lista entera (ej. "Añade al menos un método de victoria"). */
function FieldMsg({ name }: { name: string }) {
  const { error } = useFieldError(name);
  return error ? <p className="mt-1 text-xs font-medium text-shu" role="alert">{error}</p> : null;
}
