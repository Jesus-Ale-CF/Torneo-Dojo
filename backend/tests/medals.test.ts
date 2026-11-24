import { describe, expect, it } from 'vitest';
import { computeMedalTable } from '../src/modules/medals/calc.js';
import { computeStandings } from '../src/modules/brackets/standings.js';
import type { LiveMatch } from '../src/modules/brackets/advance.js';

describe('medallero', () => {
  const academies: Record<string, { id: string; name: string }> = {
    a1: { id: 'A', name: 'Alpha' },
    a2: { id: 'A', name: 'Alpha' },
    b1: { id: 'B', name: 'Beta' },
    c1: { id: 'C', name: 'Gamma' },
  };
  const academyOf = (id: string) => academies[id] ?? null;
  it('suma puntos configurables por posición', () => {
    const rows = computeMedalTable(
      [
        { categoryId: 'c1', podium: { gold: 'a1', silver: 'b1', bronze: ['c1'], complete: true } },
        { categoryId: 'c2', podium: { gold: 'b1', silver: 'a2', bronze: ['c1', 'a1'], complete: true } },
        { categoryId: 'c3', podium: { gold: null, silver: null, bronze: [], complete: false } },
      ],
      academyOf,
      { gold: 9, silver: 3, bronze: 1 },
    );
    expect(rows[0]).toMatchObject({ academyId: 'A', gold: 1, silver: 1, bronze: 1, points: 13, rank: 1 });
    expect(rows[1]).toMatchObject({ academyId: 'B', gold: 1, silver: 1, bronze: 0, points: 12, rank: 2 });
    expect(rows[2]).toMatchObject({ academyId: 'C', bronze: 2, points: 2, rank: 3 });
  });
  it('empate en puntos se resuelve por oros', () => {
    const rows = computeMedalTable(
      [
        { categoryId: 'c1', podium: { gold: 'a1', silver: null, bronze: [], complete: true } },
        { categoryId: 'c2', podium: { gold: null, silver: 'b1', bronze: ['b1', 'b1', 'b1', 'b1', 'b1', 'b1'], complete: true } },
      ],
      academyOf,
      { gold: 9, silver: 3, bronze: 1 },
    );
    expect(rows[0].academyId).toBe('A');
  });
});

describe('tabla round robin', () => {
  const m = (id: string, red: string, blue: string, winner: string, method = 'pts'): LiveMatch => ({
    id, side: 'ROUND_ROBIN', round: 1, position: 0, redId: red, blueId: blue, winnerId: winner, victoryMethodId: method,
    status: 'FINISHED', nextMatchId: null, nextSlot: null, loserNextId: null, loserNextSlot: null,
  });
  it('desempata por enfrentamiento directo y luego por puntos de método', () => {
    // A vence B, B vence C, C vence A → todos 1-1; sin head-to-head cíclico resuelto; método: C ganó por sumisión
    const matches = [m('1', 'A', 'B', 'A'), m('2', 'B', 'C', 'B'), m('3', 'C', 'A', 'C', 'sub')];
    const st = computeStandings(['A', 'B', 'C'], matches, ['WINS', 'HEAD_TO_HEAD', 'METHOD_POINTS', 'DRAW'], { pts: 2, sub: 3 });
    expect(st.map((s) => s.wins)).toEqual([1, 1, 1]);
    expect(st[0].participantId).toBe('C');
  });
  it('más victorias primero', () => {
    const matches = [m('1', 'A', 'B', 'A'), m('2', 'B', 'C', 'C'), m('3', 'C', 'A', 'A')];
    const st = computeStandings(['A', 'B', 'C'], matches, ['WINS', 'HEAD_TO_HEAD', 'DRAW']);
    expect(st.map((s) => s.participantId)).toEqual(['A', 'C', 'B']);
  });
});
