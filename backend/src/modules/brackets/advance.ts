import type { Slot } from './types.js';

/** Combate mínimo en memoria para propagar resultados (independiente de Prisma). */
export interface LiveMatch {
  id: string;
  side: string;
  round: number;
  position: number;
  redId: string | null;
  blueId: string | null;
  winnerId: string | null;
  victoryMethodId: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'BYE';
  nextMatchId: string | null;
  nextSlot: Slot | null;
  loserNextId: string | null;
  loserNextSlot: Slot | null;
}

export interface Change {
  id: string;
  patch: Partial<LiveMatch>;
  /** true si el combate tenía resultado y fue invalidado por la corrección */
  invalidated?: boolean;
}

function setSlot(m: LiveMatch, slot: Slot, value: string | null, changes: Map<string, Change>) {
  const key = slot === 'red' ? 'redId' : 'blueId';
  if (m[key] === value) return false;
  m[key] = value;
  const c = changes.get(m.id) ?? { id: m.id, patch: {} };
  c.patch[key] = value;
  changes.set(m.id, c);
  return true;
}

/**
 * Registra (o corrige) el resultado de un combate y propaga el avance.
 * Si cambian los participantes de combates posteriores ya finalizados, estos se invalidan
 * (vuelven a PENDING) y la invalidación se propaga en cascada.
 * Devuelve la lista de cambios a persistir. Muta `matches` en memoria.
 */
export function applyResult(
  matches: LiveMatch[],
  matchId: string,
  winnerId: string | null,
  victoryMethodId: string | null,
): Change[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const m = byId.get(matchId);
  if (!m) throw new Error('Combate no encontrado');
  if (winnerId && winnerId !== m.redId && winnerId !== m.blueId) {
    throw new Error('El ganador debe ser uno de los dos participantes del combate');
  }
  const changes = new Map<string, Change>();

  const loserId = winnerId ? (winnerId === m.redId ? m.blueId : m.redId) : null;
  m.winnerId = winnerId;
  m.victoryMethodId = winnerId ? victoryMethodId : null;
  m.status = winnerId ? 'FINISHED' : 'PENDING';
  changes.set(m.id, { id: m.id, patch: { winnerId: m.winnerId, victoryMethodId: m.victoryMethodId, status: m.status } });

  const queue: { targetId: string; slot: Slot; value: string | null }[] = [];
  if (m.nextMatchId && m.nextSlot) queue.push({ targetId: m.nextMatchId, slot: m.nextSlot, value: winnerId });
  if (m.loserNextId && m.loserNextSlot) queue.push({ targetId: m.loserNextId, slot: m.loserNextSlot, value: loserId });

  let guard = 0;
  while (queue.length && guard++ < 10_000) {
    const { targetId, slot, value } = queue.shift()!;
    const t = byId.get(targetId);
    if (!t) continue;
    const changed = setSlot(t, slot, value, changes);
    if (!changed) continue;
    if (t.status === 'FINISHED' || t.status === 'IN_PROGRESS') {
      // participantes cambiaron → el resultado deja de ser válido
      t.status = 'PENDING';
      t.winnerId = null;
      t.victoryMethodId = null;
      const c = changes.get(t.id)!;
      c.patch.status = 'PENDING';
      c.patch.winnerId = null;
      c.patch.victoryMethodId = null;
      c.invalidated = true;
      if (t.nextMatchId && t.nextSlot) queue.push({ targetId: t.nextMatchId, slot: t.nextSlot, value: null });
      if (t.loserNextId && t.loserNextSlot) queue.push({ targetId: t.loserNextId, slot: t.loserNextSlot, value: null });
    } else if (t.status === 'BYE') {
      // un BYE depende de su único participante: si cambia, cambia su "ganador"
      const other = slot === 'red' ? t.blueId : t.redId;
      const newWinner = value ?? other;
      t.winnerId = newWinner;
      const c = changes.get(t.id)!;
      c.patch.winnerId = newWinner;
      if (t.nextMatchId && t.nextSlot) queue.push({ targetId: t.nextMatchId, slot: t.nextSlot, value: newWinner });
    }
  }
  return [...changes.values()];
}

/** Ganador y perdedor de un combate finalizado. */
export function loserOf(m: LiveMatch): string | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.redId ? m.blueId : m.redId;
}
