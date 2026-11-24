import type { GenMatch, Participant } from '../src/modules/brackets/types.js';
import type { LiveMatch } from '../src/modules/brackets/advance.js';

export function participants(n: number, academies = 1): Participant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, academyId: `a${i % academies}`, seed: null }));
}

/** PRNG determinístico (mulberry32) */
export function rng(seed = 42) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convierte combates generados a "LiveMatch" (como si estuvieran persistidos, id = key). */
export function toLive(gen: GenMatch[]): LiveMatch[] {
  return gen.map((g) => ({
    id: g.key,
    side: g.side,
    round: g.round,
    position: g.position,
    redId: g.red,
    blueId: g.blue,
    winnerId: g.winnerId,
    victoryMethodId: null,
    status: g.status,
    nextMatchId: g.nextKey,
    nextSlot: g.nextSlot,
    loserNextId: g.loserNextKey,
    loserNextSlot: g.loserNextSlot,
  }));
}

/** Juega toda la llave: gana siempre el que tenga id "menor" (p1 > p2 > ...). */
export function playAll(live: LiveMatch[], apply: (ms: LiveMatch[], id: string, w: string, m: string | null) => unknown, pick?: (m: LiveMatch) => string) {
  let guard = 0;
  while (guard++ < 1000) {
    const next = live.find((m) => m.status === 'PENDING' && m.redId && m.blueId);
    if (!next) break;
    const w = pick ? pick(next) : best(next.redId!, next.blueId!);
    apply(live, next.id, w, 'm1');
  }
}

export function best(a: string, b: string): string {
  return Number(a.slice(1)) < Number(b.slice(1)) ? a : b;
}
