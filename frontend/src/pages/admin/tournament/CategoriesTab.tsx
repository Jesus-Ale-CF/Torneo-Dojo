import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Wand2, Pencil, Trash2, Search, GitBranch } from 'lucide-react';
import { del, patch, post } from '@/lib/api';
import type { BracketFormat, Category, Gender, Tournament } from '@/lib/types';
import { z } from 'zod';
import { useMut } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { FORMAT, FORMAT_SHORT, GENDER, fmtWeight } from '@/lib/format';
import { Modal, Confirm } from '@/components/ui/Modal';
import { Checkbox, FormErrors, Input, Select } from '@/components/ui/Field';
import { CategoryBadge } from '@/components/ui/Badge';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, EmptyState } from '@/components/ui/States';
import { useAgeGroups, useCategories, useDivisions, useMats, useSport, invalidateAll } from './shared';

type Form = { id?: string; name: string; gender: Gender; weightDivisionId: string; ageGroupId: string; beltLevelId: string; format: BracketFormat; avoidSameAcademy: boolean; tiebreakRules: string; matId: string; durationSec: string };
const FORMATS = Object.keys(FORMAT) as BracketFormat[];
const categorySchema = (f: Form) => z.object({
  name: z.string().trim().max(120),
  durationSec: z.string().refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 30 && Number(v) <= 3600), 'Entre 30 y 3600 segundos'),
}).refine(() => !!f.gender, { path: ['gender'], message: 'Este campo es obligatorio' });
const TIEBREAKS = [{ v: 'WINS,HEAD_TO_HEAD,METHOD_POINTS,DRAW', l: 'Victorias → enfrentamiento directo → puntos por método → sorteo' }, { v: 'WINS,METHOD_POINTS,HEAD_TO_HEAD,DRAW', l: 'Victorias → puntos por método → enfrentamiento directo → sorteo' }, { v: 'WINS,HEAD_TO_HEAD,DRAW', l: 'Victorias → enfrentamiento directo → sorteo' }];

export function CategoriesTab({ t }: { t: Tournament }) {
  const toast = useToast();
  const cats = useCategories(t.id);
  const sport = useSport(t.sportId);
  const divs = useDivisions(t.id);
  const ages = useAgeGroups(t.id);
  const mats = useMats(t.id);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Form | null>(null);
  const [gen, setGen] = useState<{ ageGroupIds: string[]; genders: Gender[]; beltLevelIds: string[]; weightDivisionIds: string[]; format: BracketFormat } | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [cleanEmpty, setCleanEmpty] = useState(false);
  const filtered = useMemo(() => (cats.data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())), [cats.data, q]);

  const toBody = (f: Form) => ({ name: f.name || undefined, gender: f.gender, weightDivisionId: f.weightDivisionId || null, ageGroupId: f.ageGroupId || null, beltLevelId: f.beltLevelId || null, format: f.format, avoidSameAcademy: f.avoidSameAcademy, tiebreakRules: f.tiebreakRules, matId: f.matId || null, durationSec: f.durationSec ? Number(f.durationSec) : null });
  const save = useMut((f: Form) => (f.id ? patch(`/categories/${f.id}`, toBody(f)) : post(`/tournaments/${t.id}/categories`, toBody(f))), { invalidate: invalidateAll(t.id), success: 'Categoría guardada', onSuccess: () => closeEdit(), schema: (f: Form) => categorySchema(f) });
  const closeEdit = () => { setEditing(null); save.reset(); };
  const generate = useMut((g: NonNullable<typeof gen>) => post<{ created: number; skipped: number }>(`/tournaments/${t.id}/categories/generate`, g), { invalidate: invalidateAll(t.id), onSuccess: (r) => { setGen(null); toast.success(`Categorías creadas: ${r.created} (omitidas ${r.skipped})`); } });
  const remove = useMut((id: string) => del(`/categories/${id}`), { invalidate: invalidateAll(t.id), success: 'Categoría eliminada', onSuccess: () => setToDelete(null) });
  const removeEmpty = useMut(() => del<{ deleted: number }>(`/tournaments/${t.id}/categories/empty`), { invalidate: invalidateAll(t.id), onSuccess: (r) => { setCleanEmpty(false); toast.success(`${r.deleted} categorías vacías eliminadas`); } });
  const emptyCount = (cats.data ?? []).filter((c) => c._count.registrations === 0 && c._count.matches === 0).length;
  const newForm = (): Form => ({ name: '', gender: 'M', weightDivisionId: '', ageGroupId: ages.data?.[0]?.id ?? '', beltLevelId: '', format: 'SINGLE_ELIMINATION', avoidSameAcademy: true, tiebreakRules: TIEBREAKS[0].v, matId: '', durationSec: '' });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1"><span className="sr-only">Buscar categoría</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input className="input pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {emptyCount > 0 && <button className="btn-ghost text-sm" onClick={() => setCleanEmpty(true)}><Trash2 className="h-4 w-4" aria-hidden />Limpiar {emptyCount} vacías</button>}
          <button className="btn-secondary" onClick={() => setGen({ ageGroupIds: ages.data?.map((a) => a.id) ?? [], genders: ['M', 'F'], beltLevelIds: sport.data?.beltLevels.map((b) => b.id) ?? [], weightDivisionIds: divs.data?.map((d) => d.id) ?? [], format: 'SINGLE_ELIMINATION' })}><Wand2 className="h-4 w-4" aria-hidden />Generación asistida</button>
          <button className="btn-primary" onClick={() => setEditing(newForm())}><Plus className="h-4 w-4" aria-hidden />Nueva</button>
        </div>
      </div>
      {cats.isLoading ? <ListSkeleton /> : !filtered.length ? <EmptyState title="Sin categorías" text="Crea categorías manualmente o usa la generación asistida combinando edad × género × cinturón × peso." /> : (
        <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left"><tr><th className="px-3 py-2.5">Categoría</th><th className="hidden px-3 py-2.5 md:table-cell">Formato</th><th className="px-3 py-2.5 text-center">Atletas</th><th className="hidden px-3 py-2.5 lg:table-cell">Tatami</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><BeltBadge belt={c.beltLevel} size="sm" showName={false} /><span className="font-medium">{c.name}</span></div><div className="text-xs text-muted">{GENDER[c.gender]}{c.weightDivision ? ` · ${fmtWeight(c.weightDivision)}` : ''}<span className="md:hidden"> · {FORMAT_SHORT[c.format]}</span></div></td>
                  <td className="hidden px-3 py-2 md:table-cell">{FORMAT_SHORT[c.format]}</td>
                  <td className="num px-3 py-2 text-center">{c._count.registrations}</td>
                  <td className="hidden px-3 py-2 lg:table-cell">{c.mat?.name ?? <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2"><CategoryBadge status={c.status} /></td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <Link to={`/admin/torneos/${t.id}/llaves?c=${c.id}`} className="btn-ghost h-11 w-11 px-0" aria-label={`Llave de ${c.name}`}><GitBranch className="h-4 w-4" /></Link>
                    <button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name, gender: c.gender, weightDivisionId: c.weightDivision?.id ?? '', ageGroupId: c.ageGroup?.id ?? '', beltLevelId: c.beltLevel?.id ?? '', format: c.format, avoidSameAcademy: c.avoidSameAcademy, tiebreakRules: c.tiebreakRules, matId: c.matId ?? '', durationSec: c.durationSec?.toString() ?? '' })}><Pencil className="h-4 w-4" /></button>
                    <button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${c.name}`} onClick={() => setToDelete(c)} disabled={c.status === 'IN_PROGRESS' || c.status === 'FINISHED'}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={closeEdit} title={editing?.id ? 'Editar categoría' : 'Nueva categoría'} footer={<><button type="button" className="btn-secondary" onClick={closeEdit}>Cancelar</button><button type="submit" form="form-categoria" className="btn-primary" disabled={save.isPending}>Guardar</button></>}>
        {editing && (() => { const locked = !!editing.id && cats.data?.find((c) => c.id === editing.id)?.status !== 'OPEN'; return (
          <form id="form-categoria" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}><FormErrors errors={save.fieldErrors}>
          <div className="space-y-4">
            {locked && <p className="rounded-lg border border-ai/40 bg-ai/10 p-3 text-sm">Esta categoría ya tiene llave: solo puedes cambiar nombre, tatami, duración y reglas de desempate.</p>}
            <Input label="Nombre (vacío = automático)" name="name" maxLength={120} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Adulto · Masculino · Azul · Pluma" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Grupo de edad" name="ageGroupId" value={editing.ageGroupId} disabled={locked} onChange={(e) => setEditing({ ...editing, ageGroupId: e.target.value })}><option value="">Sin restricción</option>{ages.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.minAge}–{a.maxAge})</option>)}</Select>
              <Select label="Género" name="gender" value={editing.gender} disabled={locked} onChange={(e) => setEditing({ ...editing, gender: e.target.value as Gender })}>{(['M', 'F', 'X'] as Gender[]).map((g) => <option key={g} value={g}>{GENDER[g]}</option>)}</Select>
              <Select label="Cinturón" name="beltLevelId" value={editing.beltLevelId} disabled={locked} onChange={(e) => setEditing({ ...editing, beltLevelId: e.target.value })}><option value="">Todos</option>{sport.data?.beltLevels.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
              <Select label="División de peso" name="weightDivisionId" value={editing.weightDivisionId} disabled={locked} onChange={(e) => setEditing({ ...editing, weightDivisionId: e.target.value })}><option value="">Sin límite / absoluto</option>{divs.data?.filter((d) => !d.gender || d.gender === editing.gender).map((d) => <option key={d.id} value={d.id}>{d.name} · {fmtWeight(d)}</option>)}</Select>
            </div>
            <Select label="Formato de llave" name="format" value={editing.format} disabled={locked} onChange={(e) => setEditing({ ...editing, format: e.target.value as BracketFormat })}>{FORMATS.map((f) => <option key={f} value={f}>{FORMAT[f]}</option>)}</Select>
            {editing.format === 'ROUND_ROBIN' && <Select label="Criterios de desempate" value={editing.tiebreakRules} onChange={(e) => setEditing({ ...editing, tiebreakRules: e.target.value })}>{TIEBREAKS.map((tb) => <option key={tb.v} value={tb.v}>{tb.l}</option>)}</Select>}
            {editing.format !== 'ROUND_ROBIN' && <Checkbox label="Evitar misma academia en primera ronda" hint="Cuando sea posible, atletas del mismo equipo no se cruzan al inicio" checked={editing.avoidSameAcademy} onChange={(e) => setEditing({ ...editing, avoidSameAcademy: e.target.checked })} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Tatami" name="matId" value={editing.matId} onChange={(e) => setEditing({ ...editing, matId: e.target.value })}><option value="">Sin asignar</option>{mats.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
              <Input label="Duración del combate (s)" name="durationSec" type="number" inputMode="numeric" min={30} max={3600} placeholder={String(sport.data?.defaultDurationSec ?? '')} value={editing.durationSec} onChange={(e) => setEditing({ ...editing, durationSec: e.target.value })} hint="Vacío = la del deporte" />
            </div>
          </div>
          </FormErrors></form>); })()}
      </Modal>

      <Modal open={!!gen} onClose={() => setGen(null)} title="Generación asistida de categorías" size="lg" footer={<><button className="btn-secondary" onClick={() => setGen(null)}>Cancelar</button><button className="btn-primary" disabled={generate.isPending || !gen?.genders.length} onClick={() => gen && generate.mutate(gen)}><Wand2 className="h-4 w-4" aria-hidden />Crear combinaciones</button></>}>
        {gen && (
          <div className="space-y-5">
            <p className="text-sm text-muted">Se creará una categoría por cada combinación de los criterios marcados (omitiendo las que ya existen). Las divisiones con género fijo solo se combinan con ese género. Luego podrás editar o eliminar las vacías.</p>
            <Group title="Grupos de edad" items={(ages.data ?? []).map((a) => ({ id: a.id, label: a.name }))} selected={gen.ageGroupIds} onToggle={(id) => setGen({ ...gen, ageGroupIds: toggle(gen.ageGroupIds, id) })} />
            <Group title="Géneros" items={(['M', 'F', 'X'] as Gender[]).map((g) => ({ id: g, label: GENDER[g] }))} selected={gen.genders} onToggle={(id) => setGen({ ...gen, genders: toggle(gen.genders, id as Gender) })} />
            <Group title="Cinturones" items={(sport.data?.beltLevels ?? []).map((b) => ({ id: b.id, label: b.name }))} selected={gen.beltLevelIds} onToggle={(id) => setGen({ ...gen, beltLevelIds: toggle(gen.beltLevelIds, id) })} />
            <Group title="Divisiones de peso" items={(divs.data ?? []).map((d) => ({ id: d.id, label: `${d.name}${d.gender ? ` (${d.gender})` : ''}` }))} selected={gen.weightDivisionIds} onToggle={(id) => setGen({ ...gen, weightDivisionIds: toggle(gen.weightDivisionIds, id) })} />
            <Select label="Formato por defecto" value={gen.format} onChange={(e) => setGen({ ...gen, format: e.target.value as BracketFormat })}>{FORMATS.map((f) => <option key={f} value={f}>{FORMAT[f]}</option>)}</Select>
            <p className="num text-sm">Combinaciones aproximadas: <strong>{Math.max(1, gen.ageGroupIds.length) * gen.genders.length * Math.max(1, gen.beltLevelIds.length) * Math.max(1, gen.weightDivisionIds.length)}</strong></p>
            {generate.data && <p className="text-sm text-tatami">Creadas {generate.data.created}, omitidas {generate.data.skipped}.</p>}
          </div>
        )}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar categoría" text={`Se eliminará "${toDelete?.name}". Los inscritos quedarán sin categoría.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
      <Confirm open={cleanEmpty} onClose={() => setCleanEmpty(false)} onConfirm={() => removeEmpty.mutate()} title="Eliminar categorías vacías" text={`Se eliminarán ${emptyCount} categorías sin inscritos ni combates.`} confirmLabel="Eliminar vacías" danger loading={removeEmpty.isPending} />
    </>
  );
}

function Group({ title, items, selected, onToggle }: { title: string; items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="label mb-2">{title} <span className="num">({selected.length}/{items.length})</span></legend>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => { const on = selected.includes(it.id); return <button type="button" key={it.id} aria-pressed={on} onClick={() => onToggle(it.id)} className={`btn h-10 min-h-0 px-3 text-sm border ${on ? 'border-shu bg-shu/10 text-shu' : 'border-line bg-surface text-muted'}`}>{it.label}</button>; })}
        {items.length === 0 && <span className="text-sm text-muted">Nada definido aún (ver pestaña Configuración).</span>}
      </div>
    </fieldset>
  );
}
