import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet, Download } from 'lucide-react';
import { del, downloadFile, get, patch, post } from '@/lib/api';
import type { Academy, Athlete, Sport, Tournament } from '@/lib/types';
import { GENDER, fmtDate, toDateInput } from '@/lib/format';
import { useMut } from '@/lib/hooks';
import { PageHeader } from '@/components/ui/Page';
import { Modal, Confirm } from '@/components/ui/Modal';
import { FormErrors, Input, Select } from '@/components/ui/Field';
import { athleteSchema } from '@/lib/validation';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, ErrorState, EmptyState } from '@/components/ui/States';

type Form = { id?: string; firstName: string; lastName: string; document: string; birthDate: string; gender: 'M' | 'F' | 'X'; beltLevelId: string; academyId: string; email: string; phone: string };
const empty: Form = { firstName: '', lastName: '', document: '', birthDate: '', gender: 'M', beltLevelId: '', academyId: '', email: '', phone: '' };
type ImportRow = Record<string, string | number>;
interface ImportResult { created: number; updated: number; registered: number; assigned: number; errors: { row: number; message: string }[] }

/** Normaliza cabeceras: "Fecha de nacimiento" → fechaNacimiento, "Peso declarado" → pesoDeclarado, etc. */
function normalizeHeader(h: string) {
  const k = h.toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const map: Record<string, string> = { nombre: 'nombres', nombres: 'nombres', apellido: 'apellidos', apellidos: 'apellidos', documento: 'documento', dni: 'documento', cedula: 'documento', 'fecha de nacimiento': 'fechaNacimiento', fechanacimiento: 'fechaNacimiento', nacimiento: 'fechaNacimiento', genero: 'genero', sexo: 'genero', cinturon: 'cinturon', faixa: 'cinturon', academia: 'academia', equipo: 'academia', email: 'email', correo: 'email', telefono: 'telefono', peso: 'pesoDeclarado', 'peso declarado': 'pesoDeclarado', pesodeclarado: 'pesoDeclarado' };
  return map[k] ?? k;
}

export function AthletesPage() {
  const [q, setQ] = useState('');
  const athletes = useQuery({ queryKey: ['athletes'], queryFn: () => get<Athlete[]>('/athletes') });
  const academies = useQuery({ queryKey: ['academies'], queryFn: () => get<Academy[]>('/academies') });
  const sports = useQuery({ queryKey: ['sports'], queryFn: () => get<Sport[]>('/sports') });
  const tours = useQuery({ queryKey: ['tournaments'], queryFn: () => get<Tournament[]>('/tournaments') });
  const belts = useMemo(() => sports.data?.flatMap((s) => s.beltLevels.map((b) => ({ ...b, sport: s.name }))) ?? [], [sports.data]);
  const [editing, setEditing] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Athlete | null>(null);
  const [imp, setImp] = useState<{ rows: ImportRow[]; sportId: string; tournamentId: string; result?: ImportResult; fileName?: string } | null>(null);

  const filtered = useMemo(() => { const s = q.toLowerCase(); return (athletes.data ?? []).filter((a) => !s || `${a.firstName} ${a.lastName} ${a.document} ${a.academy?.name ?? ''}`.toLowerCase().includes(s)); }, [athletes.data, q]);
  const save = useMut((f: Form) => { const body = { ...f, beltLevelId: f.beltLevelId || null, academyId: f.academyId || null, email: f.email || null, phone: f.phone || null }; delete (body as { id?: string }).id; return f.id ? patch(`/athletes/${f.id}`, body) : post('/athletes', body); }, { invalidate: [['athletes'], ['academies']], success: 'Atleta guardado', onSuccess: () => close(), schema: athleteSchema });
  const close = () => { setEditing(null); save.reset(); };
  const remove = useMut((id: string) => del(`/athletes/${id}`), { invalidate: [['athletes']], success: 'Atleta eliminado', onSuccess: () => setToDelete(null) });
  const doImport = useMut((p: { rows: ImportRow[]; sportId: string; tournamentId?: string }) => post<ImportResult>('/athletes/import', p), { invalidate: [['athletes'], ['academies'], ['registrations']], onSuccess: (r) => setImp((s) => (s ? { ...s, result: r } : s)) });

  const onFile = async (file: File) => {
    const XLSX = await import('xlsx');
    // CSV: se lee como texto UTF-8 (si no, los acentos llegan rotos); Excel: binario
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    const wb = isCsv ? XLSX.read(await file.text(), { type: 'string', cellDates: true, raw: true }) : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });
    const rows = raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normalizeHeader(k), v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '')])));
    setImp({ rows, sportId: sports.data?.[0]?.id ?? '', tournamentId: '', fileName: file.name });
  };

  return (
    <>
      <PageHeader title="Atletas" subtitle="Base de datos de competidores. Importa desde Excel o CSV y, si lo deseas, inscríbelos directamente en un torneo."
        actions={<><button className="btn-secondary" onClick={() => downloadFile('/export/athletes/template.xlsx')}><Download className="h-4 w-4" aria-hidden />Plantilla</button><label className="btn-secondary cursor-pointer"><Upload className="h-4 w-4" aria-hidden />Importar<input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label><button className="btn-primary" onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4" aria-hidden />Nuevo atleta</button></>} />
      <label className="relative mb-4 block"><span className="sr-only">Buscar atleta</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input className="input pl-9" placeholder="Buscar por nombre, documento o academia…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {athletes.isLoading ? <ListSkeleton /> : athletes.isError ? <ErrorState error={athletes.error} retry={() => athletes.refetch()} /> : !filtered.length ? <EmptyState title="Sin atletas" text={q ? 'Prueba otra búsqueda.' : 'Crea o importa atletas para empezar.'} /> : (
        <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left"><tr><th className="px-3 py-2.5">Atleta</th><th className="hidden px-3 py-2.5 md:table-cell">Documento</th><th className="hidden px-3 py-2.5 sm:table-cell">Nacimiento</th><th className="px-3 py-2.5">Cinturón</th><th className="hidden px-3 py-2.5 lg:table-cell">Academia</th><th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-3 py-2"><div className="font-medium">{a.lastName}, {a.firstName}</div><div className="text-xs text-muted">{GENDER[a.gender]}<span className="lg:hidden"> · {a.academy?.name ?? 'Sin academia'}</span></div></td>
                  <td className="num hidden px-3 py-2 md:table-cell">{a.document}</td>
                  <td className="hidden px-3 py-2 sm:table-cell">{fmtDate(a.birthDate)}</td>
                  <td className="px-3 py-2"><BeltBadge belt={a.beltLevel} size="sm" /></td>
                  <td className="hidden px-3 py-2 lg:table-cell">{a.academy?.name ?? <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap"><button className="btn-ghost h-11 w-11 px-0" aria-label={`Editar ${a.firstName} ${a.lastName}`} onClick={() => setEditing({ id: a.id, firstName: a.firstName, lastName: a.lastName, document: a.document, birthDate: toDateInput(a.birthDate), gender: a.gender, beltLevelId: a.beltLevelId ?? '', academyId: a.academyId ?? '', email: a.email ?? '', phone: a.phone ?? '' })}><Pencil className="h-4 w-4" /></button><button className="btn-ghost h-11 w-11 px-0 text-shu" aria-label={`Eliminar ${a.firstName} ${a.lastName}`} onClick={() => setToDelete(a)}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={close} title={editing?.id ? 'Editar atleta' : 'Nuevo atleta'} footer={<><button type="button" className="btn-secondary" onClick={close}>Cancelar</button><button type="submit" form="form-atleta" className="btn-primary" disabled={save.isPending}>Guardar</button></>}>
        {editing && <form id="form-atleta" noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}><FormErrors errors={save.fieldErrors}><div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Nombres" name="firstName" maxLength={60} value={editing.firstName} onChange={(e) => setEditing({ ...editing, firstName: e.target.value })} required /><Input label="Apellidos" name="lastName" maxLength={80} value={editing.lastName} onChange={(e) => setEditing({ ...editing, lastName: e.target.value })} required /></div>
          <div className="grid gap-4 sm:grid-cols-3"><Input label="Documento" name="document" maxLength={30} value={editing.document} onChange={(e) => setEditing({ ...editing, document: e.target.value })} required /><Input label="Fecha de nacimiento" name="birthDate" type="date" value={editing.birthDate} onChange={(e) => setEditing({ ...editing, birthDate: e.target.value })} required /><Select label="Género" name="gender" value={editing.gender} onChange={(e) => setEditing({ ...editing, gender: e.target.value as 'M' })}><option value="M">Masculino</option><option value="F">Femenino</option><option value="X">Otro / mixto</option></Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Cinturón / nivel" name="beltLevelId" value={editing.beltLevelId} onChange={(e) => setEditing({ ...editing, beltLevelId: e.target.value })}><option value="">Sin asignar</option>{belts.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.sport})</option>)}</Select>
            <Select label="Academia" name="academyId" value={editing.academyId} onChange={(e) => setEditing({ ...editing, academyId: e.target.value })}><option value="">Sin academia</option>{academies.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Correo" name="email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /><Input label="Teléfono" name="phone" maxLength={30} type="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
        </div></FormErrors></form>}
      </Modal>

      <Modal open={!!imp} onClose={() => setImp(null)} title="Importar atletas" size="lg" footer={imp?.result ? <button className="btn-primary" onClick={() => setImp(null)}>Cerrar</button> : <><button className="btn-secondary" onClick={() => setImp(null)}>Cancelar</button><button className="btn-primary" disabled={!imp?.sportId || doImport.isPending} onClick={() => imp && doImport.mutate({ rows: imp.rows, sportId: imp.sportId, tournamentId: imp.tournamentId || undefined })}><FileSpreadsheet className="h-4 w-4" aria-hidden />{doImport.isPending ? 'Importando…' : `Importar ${imp?.rows.length ?? 0} filas`}</button></>}>
        {imp && !imp.result && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Archivo <strong>{imp.fileName}</strong>: {imp.rows.length} filas. Columnas reconocidas: {Object.keys(imp.rows[0] ?? {}).join(', ') || '—'}.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Deporte (para reconocer cinturones)" value={imp.sportId} onChange={(e) => setImp({ ...imp, sportId: e.target.value })}>{sports.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <Select label="Inscribir en torneo (opcional)" value={imp.tournamentId} onChange={(e) => setImp({ ...imp, tournamentId: e.target.value })} hint="Se asigna categoría automáticamente si hay una única coincidencia"><option value="">No inscribir</option>{tours.data?.filter((t) => t.status !== 'FINISHED').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
            </div>
            <div className="card max-h-64 overflow-auto" tabIndex={0} role="region" aria-label="Vista previa de la importación"><table className="w-full text-xs"><thead className="bg-elevated text-left"><tr>{Object.keys(imp.rows[0] ?? {}).map((k) => <th key={k} className="px-2 py-1.5">{k}</th>)}</tr></thead><tbody>{imp.rows.slice(0, 20).map((r, i) => <tr key={i} className="border-t border-line">{Object.keys(imp.rows[0]).map((k) => <td key={k} className="px-2 py-1 whitespace-nowrap">{String(r[k] ?? '')}</td>)}</tr>)}</tbody></table></div>
            {imp.rows.length > 20 && <p className="text-xs text-muted">Mostrando 20 de {imp.rows.length} filas.</p>}
          </div>
        )}
        {imp?.result && (
          <div className="space-y-3">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Creados', imp.result.created], ['Actualizados', imp.result.updated], ['Inscritos', imp.result.registered], ['Con categoría', imp.result.assigned]].map(([l, v]) => <li key={l} className="card p-3 text-center"><span className="num block text-2xl font-bold">{v}</span><span className="text-xs text-muted">{l}</span></li>)}</ul>
            {imp.result.errors.length > 0 && <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm"><p className="mb-1 font-semibold text-warn">{imp.result.errors.length} filas con errores (no importadas)</p><ul className="max-h-40 list-inside list-disc overflow-auto text-xs">{imp.result.errors.map((e) => <li key={e.row}>Fila {e.row}: {e.message}</li>)}</ul></div>}
          </div>
        )}
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} title="Eliminar atleta" text={`Se eliminará a ${toDelete?.firstName} ${toDelete?.lastName} y sus inscripciones.`} confirmLabel="Eliminar" danger loading={remove.isPending} />
    </>
  );
}
