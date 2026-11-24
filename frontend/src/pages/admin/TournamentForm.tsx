import type { Sport, TournamentStatus } from '@/lib/types';
import { TOURNAMENT_STATUS } from '@/lib/format';
import { Input, Select, Textarea } from '@/components/ui/Field';

export interface TournamentFormData { name: string; venue: string; city: string; startDate: string; endDate: string; sportId: string; status: TournamentStatus; pointsGold: number; pointsSilver: number; pointsBronze: number; description: string }
const today = new Date().toISOString().slice(0, 10);
export const emptyTournament: TournamentFormData = { name: '', venue: '', city: '', startDate: today, endDate: today, sportId: '', status: 'DRAFT', pointsGold: 9, pointsSilver: 3, pointsBronze: 1, description: '' };

export function TournamentForm({ value, onChange, sports, editing = false }: { value: TournamentFormData; onChange: (v: TournamentFormData) => void; sports: Sport[]; editing?: boolean }) {
  const set = (p: Partial<TournamentFormData>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <Input label="Nombre del torneo" name="name" maxLength={120} value={value.name} onChange={(e) => set({ name: e.target.value })} required />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Sede" name="venue" maxLength={120} value={value.venue} onChange={(e) => set({ venue: e.target.value })} required /><Input label="Ciudad" name="city" maxLength={80} value={value.city} onChange={(e) => set({ city: e.target.value })} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Fecha de inicio" name="startDate" type="date" value={value.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: value.endDate < e.target.value ? e.target.value : value.endDate })} required /><Input label="Fecha de fin" name="endDate" type="date" min={value.startDate} value={value.endDate} onChange={(e) => set({ endDate: e.target.value })} required /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Deporte" name="sportId" value={value.sportId} onChange={(e) => set({ sportId: e.target.value })} disabled={editing} hint={editing ? 'El deporte no puede cambiarse una vez creado' : undefined}><option value="">Selecciona…</option>{sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select label="Estado" name="status" value={value.status} onChange={(e) => set({ status: e.target.value as TournamentStatus })}>{(Object.keys(TOURNAMENT_STATUS) as TournamentStatus[]).map((k) => <option key={k} value={k}>{TOURNAMENT_STATUS[k]}</option>)}</Select>
      </div>
      <fieldset className="grid grid-cols-3 gap-3 rounded-lg border border-line p-3"><legend className="label px-1">Puntos del medallero</legend>
        <Input label="Oro" name="pointsGold" type="number" inputMode="numeric" min={0} value={Number.isNaN(value.pointsGold) ? '' : value.pointsGold} onChange={(e) => set({ pointsGold: e.target.valueAsNumber })} /><Input label="Plata" name="pointsSilver" type="number" inputMode="numeric" min={0} value={Number.isNaN(value.pointsSilver) ? '' : value.pointsSilver} onChange={(e) => set({ pointsSilver: e.target.valueAsNumber })} /><Input label="Bronce" name="pointsBronze" type="number" inputMode="numeric" min={0} value={Number.isNaN(value.pointsBronze) ? '' : value.pointsBronze} onChange={(e) => set({ pointsBronze: e.target.valueAsNumber })} />
      </fieldset>
      <Textarea label="Descripción (pública)" name="description" maxLength={2000} value={value.description} onChange={(e) => set({ description: e.target.value })} />
    </div>
  );
}
