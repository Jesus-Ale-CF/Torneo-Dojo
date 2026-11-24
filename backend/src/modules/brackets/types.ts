export type Slot = 'red' | 'blue';
export type Side = 'WINNERS' | 'LOSERS' | 'GRAND_FINAL' | 'THIRD_PLACE' | 'ROUND_ROBIN';
export type Format =
  | 'SINGLE_ELIMINATION'
  | 'SINGLE_ELIMINATION_BRONZE'
  | 'DOUBLE_ELIMINATION'
  | 'ROUND_ROBIN';

/** Participante mínimo para generar una llave. */
export interface Participant {
  id: string;
  academyId?: string | null;
  seed?: number | null; // siembra manual (1 = mejor)
}

/** Combate generado (sin persistir). */
export interface GenMatch {
  key: string;
  side: Side;
  round: number;
  position: number;
  label?: string;
  order: number;
  red: string | null;
  blue: string | null;
  status: 'PENDING' | 'BYE';
  winnerId: string | null;
  nextKey: string | null;
  nextSlot: Slot | null;
  loserNextKey: string | null;
  loserNextSlot: Slot | null;
}

export interface GenerateOptions {
  format: Format;
  participants: Participant[];
  /** true = respeta `seed` de los participantes; false = sorteo aleatorio */
  manualSeeding?: boolean;
  avoidSameAcademy?: boolean;
  /** función aleatoria inyectable (para pruebas determinísticas) */
  random?: () => number;
}
