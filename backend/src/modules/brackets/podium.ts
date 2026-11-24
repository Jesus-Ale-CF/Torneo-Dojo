import type { LiveMatch } from './advance.js';
import { loserOf } from './advance.js';
import { computeStandings, parseTiebreakRules } from './standings.js';
import type { Format } from './types.js';

export interface Podium {
  gold: string | null;
  silver: string | null;
  bronze: string[]; // 1 o 2 bronces según formato
  complete: boolean;
}

/**
 * Calcula el podio de una categoría a partir de sus combates.
 * - Eliminación simple: oro/plata de la final; bronce = perdedores de semifinal (regla BJJ, dos bronces).
 * - Eliminación simple con bronce: bronce = ganador del combate por el 3er lugar (o el único semifinalista perdedor si hubo BYE).
 * - Eliminación doble: oro/plata de la gran final; bronce = perdedor de la final de repechaje.
 * - Round robin: 1°, 2° y 3° de la tabla de posiciones (una vez jugados todos los combates).
 */
export function computePodium(
  format: Format,
  matches: LiveMatch[],
  participantIds: string[],
  opts: { tiebreakRules?: string | null; methodPoints?: Record<string, number>; drawOrder?: string[] } = {},
): Podium {
  const empty: Podium = { gold: null, silver: null, bronze: [], complete: false };
  if (participantIds.length === 1) return { gold: participantIds[0], silver: null, bronze: [], complete: true };
  if (!matches.length) return empty;

  if (format === 'ROUND_ROBIN') {
    const real = matches.filter((m) => m.status !== 'BYE');
    const complete = real.every((m) => m.status === 'FINISHED');
    if (!complete) return empty;
    const st = computeStandings(participantIds, matches, parseTiebreakRules(opts.tiebreakRules), opts.methodPoints, opts.drawOrder);
    return {
      gold: st[0]?.participantId ?? null,
      silver: st[1]?.participantId ?? null,
      bronze: st[2] ? [st[2].participantId] : [],
      complete: true,
    };
  }

  if (format === 'DOUBLE_ELIMINATION') {
    const gf = matches.find((m) => m.side === 'GRAND_FINAL');
    const finalM = gf ?? matches.filter((m) => m.side === 'WINNERS').sort((a, b) => b.round - a.round)[0];
    if (!finalM || finalM.status !== 'FINISHED') return empty;
    const lbFinal = matches.filter((m) => m.side === 'LOSERS').sort((a, b) => b.round - a.round)[0];
    const bronze = lbFinal && lbFinal.status === 'FINISHED' ? loserOf(lbFinal) : null;
    return { gold: finalM.winnerId, silver: loserOf(finalM), bronze: bronze ? [bronze] : [], complete: true };
  }

  // Eliminación simple (con o sin bronce)
  const wb = matches.filter((m) => m.side === 'WINNERS');
  const lastRound = Math.max(...wb.map((m) => m.round));
  const finalM = wb.find((m) => m.round === lastRound);
  if (!finalM || finalM.status !== 'FINISHED') return empty;
  const semis = wb.filter((m) => m.round === lastRound - 1);
  let bronze: string[] = [];
  if (format === 'SINGLE_ELIMINATION_BRONZE') {
    const third = matches.find((m) => m.side === 'THIRD_PLACE');
    if (third) {
      if (third.status !== 'FINISHED') return empty;
      bronze = third.winnerId ? [third.winnerId] : [];
    } else {
      // no hubo combate por el bronce (BYE en semis): el perdedor de la única semifinal real es bronce
      bronze = semis.filter((m) => m.status === 'FINISHED').map(loserOf).filter((x): x is string => !!x);
    }
  } else {
    bronze = semis.filter((m) => m.status === 'FINISHED').map(loserOf).filter((x): x is string => !!x);
  }
  return { gold: finalM.winnerId, silver: loserOf(finalM), bronze, complete: true };
}
