import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api';
import type { Academy } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { PageHeader } from '@/components/ui/Page';
import { Modal, Confirm } from '@/components/ui/Modal';
import { FormErrors, Input } from '@/components/ui/Field';
import { academySchema } from '@/lib/validation';
import { ListSkeleton, ErrorState, EmptyState } from '@/components/ui/States';

type Form = { id?: string; name: string; abbreviation: string; city: string; color: string };
export function AcademiesPage() {
  const q = useQuery({ queryKey: ['academies'], queryFn: () => get<Academy[]>('/academies') });
  const [editing, setEditing] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Academy | null>(null);
  const save = useMut((f: Form) => { const body = { name: f.name, abbreviation: f.abbreviation || null, city: f.city || null, color: f.color || null }; return f.id ? patch(`/academies/${f.id}`, body) : post('/academies', body); }, { invalidate: [['academies']], success: 'Academia guardada', onSuccess: () => close(), schema: academySchema });
  const close = () => { setEditing(null); save.reset(); };
  const remove = useMut((id: string) => del(`/academies/${id}`), { invalidate: [['academies']], success: 'Academia eliminada', onSuccess: () => setToDelete(null) });
  return (
    <>
      <PageHeader title="Academias" subtitle="Equipos a los que pertenecen los atletas. Base del medallero por academia." actions={<button className="btn-primary" onClick={() => setEditing({ name: '', abbreviation: '', city: '', color: '#2a63c9' })}><Plus className="h-4 w-4" aria-hidden />Nueva academia</button>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="Sin academias" /> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((a) => (
            <li key={a.id} className="card obi flex items-center gap-3 p-4 pl-5" style={{ '--obi': a.color ?? undefined } as React.CSSProperties}>
              <div className="min-w-0 flex-1"><h2 className="truncate text-base">{a.name}</h2><p className="text-sm text-muted">{[a.abbreviation, a.city].filter(Boolean).join(' · ')} · <span className="num">{a._count.athletes}</span> atletas</p></div>
              <button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar ${a.name}`} onClick={() => setEditing({ id: a.id, name: a.name, abbreviation: a.abbreviation ?? '', city: a.city ?? '', color: a.color ?? '#2a63c9' })}><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${a.name}`} onClick={() => setToDelete(a)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!editing} onClose={close} title={editing?.id ? 'Editar academia' : 'Nueva academia'} size="sm" footer={<><button type="button" className="btn-secondary" onClick={close}>Cancelar</button><button type="submit" form="form-academia" className="btn-primary" disabled={save.isPending}>Guardar</button></>}>
        {editing && <form id="form-academia" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}><FormErrors errors={save.fieldErrors}><div className="space-y-4">
          <Input label="Nombre" name="name" maxLength={100} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4"><Input label="Abreviatura" name="abbreviation" maxLength={8} value={editing.abbreviation} onChange={(e) => setEditing({ ...editing, abbreviation: e.target.value.toUpperCase() })} /><Input label="Ciudad" name="city" maxLength={80} value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
          <label className="flex items-center gap-3 text-sm font-medium">Color<input type="color" name="color" className="h-11 w-16 rounded-lg border border-line bg-surface" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></label>
        </div></FormErrors></form>}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar academia" text={`Los atletas de "${toDelete?.name}" quedarán sin academia.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </>
  );
}
