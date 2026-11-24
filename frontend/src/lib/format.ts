import type { BracketFormat, CategoryStatus, Gender, MatchStatus, TournamentStatus, WeighInStatus } from './types';

export const GENDER: Record<Gender, string> = { M: 'Masculino', F: 'Femenino', X: 'Mixto' };
export const TOURNAMENT_STATUS: Record<TournamentStatus, string> = { DRAFT: 'Borrador', REGISTRATION: 'Inscripción', WEIGH_IN: 'Pesaje', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado' };
export const FORMAT: Record<BracketFormat, string> = { SINGLE_ELIMINATION: 'Eliminación simple', SINGLE_ELIMINATION_BRONZE: 'Eliminación simple + bronce', DOUBLE_ELIMINATION: 'Eliminación doble', ROUND_ROBIN: 'Todos contra todos' };
export const FORMAT_SHORT: Record<BracketFormat, string> = { SINGLE_ELIMINATION: 'Simple', SINGLE_ELIMINATION_BRONZE: 'Simple + 3º', DOUBLE_ELIMINATION: 'Doble', ROUND_ROBIN: 'Round robin' };
export const CATEGORY_STATUS: Record<CategoryStatus, string> = { OPEN: 'Inscripción', BRACKET_READY: 'Llave lista', IN_PROGRESS: 'En curso', FINISHED: 'Finalizada' };
export const WEIGH: Record<WeighInStatus, string> = { PENDING: 'Sin pesar', OK: 'Apto', OVERWEIGHT: 'Sobrepeso', UNDERWEIGHT: 'Bajo peso', DISQUALIFIED: 'Descalificado' };
export const MATCH_STATUS: Record<MatchStatus, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado', BYE: 'BYE' };
export const SIDE: Record<string, string> = { WINNERS: 'Llave principal', LOSERS: 'Repechaje', GRAND_FINAL: 'Gran final', THIRD_PLACE: 'Tercer lugar', ROUND_ROBIN: 'Todos contra todos' };

export const fullName = (a: { firstName: string; lastName: string } | null | undefined) => (a ? `${a.firstName} ${a.lastName}` : '—');
export const shortName = (a: { firstName: string; lastName: string } | null | undefined) => (a ? `${a.firstName} ${a.lastName.split(' ')[0]}` : '—');
export const initials = (a: { firstName: string; lastName: string } | null | undefined) => (a ? `${a.firstName[0] ?? ''}${a.lastName[0] ?? ''}`.toUpperCase() : '');

export const fmtDate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('es-ES', opts) : '—';
export const fmtTime = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtDateTime = (d: string | Date | null | undefined) => (d ? `${fmtDate(d, { day: 'numeric', month: 'short' })} · ${fmtTime(d)}` : '—');
export const fmtRange = (a: string, b: string) => {
  const da = new Date(a); const db = new Date(b);
  if (da.toDateString() === db.toDateString()) return fmtDate(a);
  return `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b)}`;
};
export const fmtWeight = (d: { minKg: number | null; maxKg: number | null } | null | undefined) => {
  if (!d) return '';
  if (d.minKg == null && d.maxKg == null) return 'Absoluto';
  if (d.minKg == null) return `hasta ${d.maxKg} kg`;
  if (d.maxKg == null) return `más de ${d.minKg} kg`;
  return `${d.minKg} – ${d.maxKg} kg`;
};
export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const toDateInput = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
export const roundName = (m: { label: string | null; round: number; side: string }) => m.label ?? (m.side === 'LOSERS' ? `Repechaje R${m.round}` : `Ronda ${m.round}`);
