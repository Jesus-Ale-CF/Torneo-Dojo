import type { LiveMatch } from './advance.js';

export interface StandingRow {
  participantId: string;
  played: number;
  wins: number;
  losses: number;
  methodPoints: number;
  rank: number;
}

export type TiebreakRule = 'WINS' | 'HEAD_TO_HEAD' | 'METHOD_POINTS' | 'FEWEST_LOSSES' | 'DRAW';

export function parseTiebreakRules(s: string | null | undefined): TiebreakRule[] {
  const valid: TiebreakRule[] = ['WINS', 'HEAD_TO_HEAD', 'METHOD_POINTS', 'FEWEST_LOSSES', 'DRAW'];
  const rules = (s ?? '')
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter((x): x is TiebreakRule => (valid as string[]).includes(x));
  return rules.length ? rules : ['WINS', 'HEAD_TO_HEAD', 'METHOD_POINTS', 'DRAW'];
}

/**
 * Tabla de posiciones de round robin.
 * @param methodPoints puntos por método de victoria (id → puntos)
 * @param drawOrder orden de desempate final (ej. orden de siembra o aleatorio fijo)
 */
export function computeStandings(
  participantIds: string[],
  matches: LiveMatch[],
  rules: TiebreakRule[],
  methodPoints: Record<string, number> = {},
  drawOrder: string[] = participantIds,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of participantIds) rows.set(id, { participantId: id, played: 0, wins: 0, losses: 0, methodPoints: 0, rank: 0 });
  const finished = matches.filter((m) => m.status === 'FINISHED' && m.winnerId);
  for (const m of finished) {
    const w = rows.get(m.winnerId!);
    const lId = m.winnerId === m.redId ? m.blueId : m.redId;
    const l = lId ? rows.get(lId) : undefined;
    if (w) {
      w.played++;
      w.wins++;
      w.methodPoints += m.victoryMethodId ? methodPoints[m.victoryMethodId] ?? 1 : 1;
    }
    if (l) {
      l.played++;
      l.losses++;
    }
  }
  // Clasificación por grupos: cada regla se aplica solo dentro del grupo empatado,
  // y el enfrentamiento directo se evalúa entre los miembros del grupo (evita ciclos no transitivos).
  const drawIdx = new Map(drawOrder.map((id, i) => [id, i]));
  const winsWithin = (ids: Set<string>): Map<string, number> => {
    const w = new Map<string, number>();
    for (const id of ids) w.set(id, 0);
    for (const m of finished) {
      if (m.redId && m.blueId && ids.has(m.redId) && ids.has(m.blueId) && m.winnerId && ids.has(m.winnerId)) {
        w.set(m.winnerId, (w.get(m.winnerId) ?? 0) + 1);
      }
    }
    return w;
  };
  const keyFor = (row: StandingRow, rule: TiebreakRule, h2h: Map<string, number>): number => {
    switch (rule) {
      case 'WINS':
        return -row.wins;
      case 'FEWEST_LOSSES':
        return row.losses;
      case 'METHOD_POINTS':
        return -row.methodPoints;
      case 'HEAD_TO_HEAD':
        return -(h2h.get(row.participantId) ?? 0);
      case 'DRAW':
        return drawIdx.get(row.participantId) ?? 0;
    }
  };
  const rankGroup = (group: StandingRow[], ruleIdx: number): StandingRow[] => {
    if (group.length <= 1 || ruleIdx >= rules.length) return group;
    const rule = rules[ruleIdx];
    const h2h = rule === 'HEAD_TO_HEAD' ? winsWithin(new Set(group.map((g) => g.participantId))) : new Map<string, number>();
    const buckets = new Map<number, StandingRow[]>();
    for (const g of group) {
      const k = keyFor(g, rule, h2h);
      buckets.set(k, [...(buckets.get(k) ?? []), g]);
    }
    const keys = [...buckets.keys()].sort((a, b) => a - b);
    return keys.flatMap((k) => rankGroup(buckets.get(k)!, ruleIdx + 1));
  };
  const list = rankGroup([...rows.values()], 0);
  list.forEach((r, i) => (r.rank = i + 1));
  return list;
}
