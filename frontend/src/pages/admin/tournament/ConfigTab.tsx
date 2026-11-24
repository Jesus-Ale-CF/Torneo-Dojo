import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { del, patch, post } from '@/lib/api';
import type { AgeGroup, Gender, Tournament, WeightDivision } from '@/lib/types';
import { useMut } from '@/lib/hooks';
import { toDateInput } from '@/lib/format';
import { FormErrors, Input, Select } from '@/components/ui/Field';
import { ageGroupSchema, divisionSchema, tournamentSchema } from '@/lib/validation';
import { Confirm } from '@/components/ui/Modal';
import { TournamentForm, type TournamentFormData } from '../TournamentForm';
import { useAgeGroups, useDivisions, useSport, invalidateAll } from './shared';

export function ConfigTab({ t }: { t: Tournament }) {
  const nav = useNavigate();
  const sport = useSport(t.sportId);
  const [form, setForm] = useState<TournamentFormData>({ name: t.name, venue: t.venue, city: t.city ?? '', startDate: toDateInput(t.startDate), endDate: toDateInput(t.endDate), sportId: t.sportId, status: t.status, pointsGold: t.pointsGold, pointsSilver: t.pointsSilver, pointsBronze: t.pointsBronze, description: t.description ?? '' });
  const save = useMut((f: TournamentFormData) => patch(`/tournaments/${t.id}`, { ...f, city: f.city || null, description: f.description || null }), { invalidate: invalidateAll(t.id), success: 'Torneo actualizado', schema: tournamentSchema });
  const remove = useMut(() => del(`/tournaments/${t.id}`), { invalidate: [['tournaments']], success: 'Torneo eliminado', onSuccess: () => nav('/admin/torneos') });
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <section className="card p-5">
        <h2 className="mb-4 text-lg">Datos del torneo</h2>
        <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <FormErrors errors={save.fieldErrors}><TournamentForm value={form} onChange={setForm} sports={sport.data ? [sport.data] : []} editing /></FormErrors>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-ghost text-shu" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" aria-hidden />Eliminar torneo</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}><Save className="h-4 w-4" aria-hidden />Guardar cambios</button>
          </div>
        </form>
      </section>
      <div className="space-y-8">
        <Divisions t={t} />
        <AgeGroups t={t} />
      </div>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={() => remove.mutate()} title="Eliminar torneo" text={<span className="flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0 text-shu" aria-hidden />Se eliminarán categorías, inscripciones, llaves y resultados. Esta acción no se puede deshacer.</span>} confirmLabel="Eliminar definitivamente" danger loading={remove.isPending} />
    </div>
  );
}

const GENDERS: { v: '' | Gender; l: string }[] = [{ v: '', l: 'Todos' }, { v: 'M', l: 'Masculino' }, { v: 'F', l: 'Femenino' }, { v: 'X', l: 'Mixto' }];
type DivForm = { name: string; minKg: string; maxKg: string; gender: '' | Gender };

function Divisions({ t }: { t: Tournament }) {
  const q = useDivisions(t.id);
  const [f, setF] = useState<DivForm>({ name: '', minKg: '', maxKg: '', gender: '' });
  const add = useMut((d: DivForm) => post(`/tournaments/${t.id}/weight-divisions`, { name: d.name, minKg: d.minKg ? Number(d.minKg) : null, maxKg: d.maxKg ? Number(d.maxKg) : null, gender: d.gender || null, order: (q.data?.length ?? 0) + 1 }), { invalidate: [['divisions', t.id]], success: 'División añadida', onSuccess: () => setF({ name: '', minKg: '', maxKg: '', gender: f.gender }), schema: divisionSchema });
  const remove = useMut((id: string) => del(`/tournaments/weight-divisions/${id}`), { invalidate: [['divisions', t.id]], success: 'División eliminada' });
  return (
    <section className="card p-5">
      <h2 className="text-lg">Divisiones de peso</h2>
      <p className="mb-4 text-sm text-muted">Rangos inclusivos en kg. Deja el mínimo vacío para "hasta X" y el máximo vacío para "más de X" o absoluto.</p>
      <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
        {q.data?.map((d: WeightDivision) => (
          <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="flex-1 font-medium">{d.name}</span><span className="num text-muted">{d.minKg ?? '—'} – {d.maxKg ?? '—'} kg</span><span className="w-20 text-xs text-muted">{d.gender ? GENDERS.find((g) => g.v === d.gender)?.l : 'Todos'}</span><button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${d.name}`} onClick={() => remove.mutate(d.id)}><Trash2 className="h-4 w-4" /></button></li>
        ))}
        {q.data?.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin divisiones. Añade la primera.</li>}
      </ul>
      <FormErrors errors={add.fieldErrors}><form noValidate className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[1fr_90px_90px_120px_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(f); }}>
        <Input label="Nombre" name="name" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Pluma" className="col-span-2 sm:col-span-1" />
        <Input label="Mín kg" name="minKg" type="number" inputMode="decimal" step="0.01" min={0} value={f.minKg} onChange={(e) => setF({ ...f, minKg: e.target.value })} />
        <Input label="Máx kg" name="maxKg" type="number" inputMode="decimal" step="0.01" min={0} value={f.maxKg} onChange={(e) => setF({ ...f, maxKg: e.target.value })} />
        <Select label="Género" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value as Gender | '' })}>{GENDERS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}</Select>
        <div className="flex items-end self-end"><button type="submit" className="btn-secondary w-full" disabled={add.isPending}><Plus className="h-4 w-4" aria-hidden />Añadir</button></div>
      </form></FormErrors>
    </section>
  );
}

function AgeGroups({ t }: { t: Tournament }) {
  const q = useAgeGroups(t.id);
  const [f, setF] = useState({ name: '', minAge: '', maxAge: '' });
  const add = useMut((d: typeof f) => post(`/tournaments/${t.id}/age-groups`, { name: d.name, minAge: Number(d.minAge), maxAge: Number(d.maxAge), order: (q.data?.length ?? 0) + 1 }), { invalidate: [['ageGroups', t.id]], success: 'Grupo de edad añadido', onSuccess: () => setF({ name: '', minAge: '', maxAge: '' }), schema: ageGroupSchema });
  const remove = useMut((id: string) => del(`/tournaments/age-groups/${id}`), { invalidate: [['ageGroups', t.id]], success: 'Grupo eliminado' });
  return (
    <section className="card p-5">
      <h2 className="text-lg">Grupos de edad</h2>
      <p className="mb-4 text-sm text-muted">La edad competitiva es la que el atleta cumple en el año del torneo (convención IBJJF).</p>
      <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
        {q.data?.map((a: AgeGroup) => <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="flex-1 font-medium">{a.name}</span><span className="num text-muted">{a.minAge} – {a.maxAge} años</span><button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${a.name}`} onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></button></li>)}
        {q.data?.length === 0 && <li className="px-3 py-3 text-sm text-muted">Sin grupos de edad.</li>}
      </ul>
      <FormErrors errors={add.fieldErrors}><form noValidate className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[1fr_90px_90px_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(f); }}>
        <Input label="Nombre" name="name" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Adulto" className="col-span-2 sm:col-span-1" />
        <Input label="Desde" name="minAge" type="number" inputMode="numeric" min={0} value={f.minAge} onChange={(e) => setF({ ...f, minAge: e.target.value })} />
        <Input label="Hasta" name="maxAge" type="number" inputMode="numeric" min={0} value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: e.target.value })} />
        <div className="flex items-end self-end"><button type="submit" className="btn-secondary w-full" disabled={add.isPending}><Plus className="h-4 w-4" aria-hidden />Añadir</button></div>
      </form></FormErrors>
    </section>
  );
}
