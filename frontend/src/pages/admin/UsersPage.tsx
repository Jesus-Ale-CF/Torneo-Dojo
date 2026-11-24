import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shield, Tablet } from 'lucide-react';
import { del, get, patch, post } from '@/lib/api';
import type { AdminUser, Mat, Tournament } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui/Page';
import { Modal, Confirm } from '@/components/ui/Modal';
import { Checkbox, FormErrors, Input, Select } from '@/components/ui/Field';
import { userSchema } from '@/lib/validation';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton, ErrorState } from '@/components/ui/States';

type Form = { id?: string; email: string; name: string; password: string; role: 'ADMIN' | 'TABLE'; active: boolean; matIds: string[] };
export function UsersPage() {
  const { user: me } = useAuth();
  const q = useQuery({ queryKey: ['users'], queryFn: () => get<AdminUser[]>('/users') });
  const tours = useQuery({ queryKey: ['tournaments'], queryFn: () => get<Tournament[]>('/tournaments') });
  const [editing, setEditing] = useState<Form | null>(null);
  const [tid, setTid] = useState('');
  const mats = useQuery({ queryKey: ['mats', tid], queryFn: () => get<Mat[]>(`/tournaments/${tid}/mats`), enabled: !!tid });
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const save = useMut((f: Form) => { const body: Record<string, unknown> = { email: f.email, name: f.name, role: f.role, matIds: f.matIds, active: f.active }; if (f.password) body.password = f.password; return f.id ? patch(`/users/${f.id}`, body) : post('/users', body); }, { invalidate: [['users']], success: 'Usuario guardado', onSuccess: () => close(), schema: (f) => userSchema(!f.id) });
  const close = () => { setEditing(null); save.reset(); };
  const remove = useMut((id: string) => del(`/users/${id}`), { invalidate: [['users']], success: 'Usuario eliminado', onSuccess: () => setToDelete(null) });
  const open = (u?: AdminUser) => { setEditing(u ? { id: u.id, email: u.email, name: u.name, password: '', role: u.role, active: u.active, matIds: u.mats.map((m) => m.id) } : { email: '', name: '', password: '', role: 'TABLE', active: true, matIds: [] }); setTid(u?.mats[0]?.tournamentId ?? tours.data?.find((t) => t.status !== 'FINISHED')?.id ?? ''); };
  return (
    <>
      <PageHeader title="Usuarios" subtitle="Administradores y usuarios de mesa. La mesa solo puede registrar resultados en sus tatamis asignados." actions={<button className="btn-primary" onClick={() => open()}><Plus className="h-4 w-4" aria-hidden />Nuevo usuario</button>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <ul className="card divide-y divide-line">
          {q.data!.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className={`rounded-lg p-2 ${u.role === 'ADMIN' ? 'bg-shu/10 text-shu' : 'bg-ai/10 text-ai'}`}>{u.role === 'ADMIN' ? <Shield className="h-5 w-5" aria-hidden /> : <Tablet className="h-5 w-5" aria-hidden />}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{u.name}</span>{!u.active && <Badge tone="warn">Inactivo</Badge>}{u.id === me?.id && <Badge tone="ai">Tú</Badge>}</div><div className="truncate text-sm text-muted">{u.email} · {u.role === 'ADMIN' ? 'Administrador' : 'Mesa de control'}</div>{u.mats.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{u.mats.map((m) => <Badge key={m.id}>{m.tournamentName} · {m.name}</Badge>)}</div>}</div>
              <button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar ${u.name}`} onClick={() => open(u)}><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${u.name}`} disabled={u.id === me?.id} onClick={() => setToDelete(u)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!editing} onClose={close} title={editing?.id ? 'Editar usuario' : 'Nuevo usuario'} footer={<><button type="button" className="btn-secondary" onClick={close}>Cancelar</button><button type="submit" form="form-usuario" className="btn-primary" disabled={save.isPending}>Guardar</button></>}>
        {editing && <form id="form-usuario" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}><FormErrors errors={save.fieldErrors}><div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Nombre" name="name" maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /><Input label="Correo" name="email" type="email" autoComplete="off" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Input label={editing.id ? 'Nueva contraseña (opcional)' : 'Contraseña'} name="password" type="password" autoComplete="new-password" minLength={6} value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} hint="Mínimo 6 caracteres" /><Select label="Rol" name="role" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as 'ADMIN' | 'TABLE' })}><option value="TABLE">Mesa de control</option><option value="ADMIN">Administrador</option></Select></div>
          {editing.id && <Checkbox label="Usuario activo" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />}
          {editing.role === 'TABLE' && (
            <fieldset className="rounded-lg border border-line p-3">
              <legend className="label px-1">Tatamis asignados</legend>
              <Select label="Torneo" value={tid} onChange={(e) => setTid(e.target.value)}><option value="">Selecciona un torneo</option>{tours.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
              <div className="mt-3 grid gap-1 sm:grid-cols-2">
                {mats.data?.map((m) => <Checkbox key={m.id} label={m.name} checked={editing.matIds.includes(m.id)} onChange={(e) => setEditing({ ...editing, matIds: e.target.checked ? [...editing.matIds, m.id] : editing.matIds.filter((x) => x !== m.id) })} />)}
                {tid && mats.data?.length === 0 && <p className="text-sm text-muted">Este torneo no tiene tatamis.</p>}
              </div>
              {editing.matIds.length > 0 && <p className="mt-2 text-xs text-muted">{editing.matIds.length} tatami(s) asignado(s), incluidos los de otros torneos.</p>}
            </fieldset>
          )}
        </div></FormErrors></form>}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar usuario" text={`Se eliminará la cuenta de ${toDelete?.name}.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </>
  );
}
