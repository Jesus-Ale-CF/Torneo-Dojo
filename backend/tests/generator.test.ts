import { describe, expect, it } from 'vitest';
import { generateBracket, nextPowerOfTwo, seedOrder, avoidSameAcademyFirstRound } from '../src/modules/brackets/generator.js';
import { applyResult } from '../src/modules/brackets/advance.js';
import { computePodium } from '../src/modules/brackets/podium.js';
import { participants, rng, toLive, playAll } from './helpers.js';

describe('utilidades', () => {
  it('nextPowerOfTwo', () => {
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(17)).toBe(32);
  });
  it('seedOrder estándar', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('eliminación simple', () => {
  it('4 participantes → 3 combates sin BYE', () => {
    const ms = generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(4), random: rng() });
    expect(ms).toHaveLength(3);
    expect(ms.filter((m) => m.status === 'BYE')).toHaveLength(0);
    expect(ms.find((m) => m.label === 'Final')).toBeTruthy();
  });
  it('5 participantes → 8 slots, 3 BYEs, final jugable', () => {
    const ms = generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(5), random: rng() });
    const byes = ms.filter((m) => m.status === 'BYE');
    expect(byes).toHaveLength(3);
    expect(byes.every((b) => b.winnerId && (b.red || b.blue))).toBe(true);
    // ronda 2: los ganadores de BYE ya están colocados
    const r2 = ms.filter((m) => m.round === 2 && m.side === 'WINNERS');
    const prefilled = r2.flatMap((m) => [m.red, m.blue]).filter(Boolean);
    expect(prefilled).toHaveLength(3);
  });
  it('1 participante → sin combates', () => {
    expect(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(1) })).toHaveLength(0);
  });
  it.each([2, 3, 6, 7, 9, 13, 16, 21])('con %i participantes se juega hasta un campeón', (n) => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(n), random: rng(n) }));
    playAll(live, applyResult);
    const podium = computePodium('SINGLE_ELIMINATION', live, participants(n).map((p) => p.id));
    expect(podium.complete).toBe(true);
    expect(podium.gold).toBe('p1'); // el "mejor" siempre gana
    expect(podium.silver).not.toBe('p1');
    expect(podium.bronze.length).toBe(n >= 4 ? 2 : n === 3 ? 1 : 0);
    // número de combates reales = n - 1
    expect(live.filter((m) => m.status === 'FINISHED')).toHaveLength(n - 1);
  });
  it('siembra manual: seed 1 y 2 quedan en mitades opuestas', () => {
    const ps = participants(8).map((p, i) => ({ ...p, seed: i < 2 ? i + 1 : null }));
    const ms = generateBracket({ format: 'SINGLE_ELIMINATION', participants: ps, manualSeeding: true, random: rng(), avoidSameAcademy: false });
    const r1 = ms.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
    const posOf = (id: string) => r1.findIndex((m) => m.red === id || m.blue === id);
    expect(posOf('p1')).toBe(0);
    expect(posOf('p2')).toBeGreaterThanOrEqual(2); // mitad inferior
  });
  it('evita misma academia en primera ronda cuando es posible', () => {
    const ps = participants(8, 4); // 4 academias, 2 atletas cada una
    const ms = generateBracket({ format: 'SINGLE_ELIMINATION', participants: ps, avoidSameAcademy: true, random: rng(7) });
    const r1 = ms.filter((m) => m.round === 1);
    const acad = (id: string | null) => ps.find((p) => p.id === id)?.academyId;
    expect(r1.every((m) => acad(m.red) !== acad(m.blue))).toBe(true);
  });
  it('avoidSameAcademy no rompe cuando es imposible (todos de la misma academia)', () => {
    const slots = participants(4, 1);
    const out = avoidSameAcademyFirstRound(slots, new Set());
    expect(out.map((p) => p?.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe('eliminación simple con bronce', () => {
  it('8 participantes: combate por el 3er lugar con los perdedores de semis', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION_BRONZE', participants: participants(8), random: rng() }));
    expect(live.find((m) => m.side === 'THIRD_PLACE')).toBeTruthy();
    playAll(live, applyResult);
    const podium = computePodium('SINGLE_ELIMINATION_BRONZE', live, participants(8).map((p) => p.id));
    expect(podium.complete).toBe(true);
    expect(podium.gold).toBe('p1');
    expect(podium.bronze).toHaveLength(1);
    const third = live.find((m) => m.side === 'THIRD_PLACE')!;
    expect(third.status).toBe('FINISHED');
    expect(third.winnerId).toBe(podium.bronze[0]);
  });
  it('3 participantes: el combate por bronce se colapsa y el perdedor de la semi real es bronce', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION_BRONZE', participants: participants(3), random: rng() }));
    expect(live.find((m) => m.side === 'THIRD_PLACE')).toBeUndefined();
    playAll(live, applyResult);
    const podium = computePodium('SINGLE_ELIMINATION_BRONZE', live, ['p1', 'p2', 'p3']);
    expect(podium.complete).toBe(true);
    expect(podium.bronze).toHaveLength(1);
    expect(new Set([podium.gold, podium.silver, podium.bronze[0]])).toEqual(new Set(['p1', 'p2', 'p3']));
  });
});

describe('eliminación doble', () => {
  it.each([3, 4, 5, 6, 8, 11, 16])('con %i participantes termina con gran final y bronce', (n) => {
    const ids = participants(n).map((p) => p.id);
    // siembra manual por fuerza (p1 mejor) para que el podio esperado sea determinista
    const seeded = participants(n).map((p, i) => ({ ...p, seed: i + 1 }));
    const live = toLive(generateBracket({ format: 'DOUBLE_ELIMINATION', participants: seeded, manualSeeding: true, random: rng(n) }));
    expect(live.find((m) => m.side === 'GRAND_FINAL')).toBeTruthy();
    playAll(live, applyResult);
    expect(live.every((m) => m.status === 'FINISHED' || m.status === 'BYE')).toBe(true);
    const podium = computePodium('DOUBLE_ELIMINATION', live, ids);
    expect(podium.complete).toBe(true);
    expect(podium.gold).toBe('p1');
    expect(podium.silver).toBe('p2'); // p2 pierde con p1 en WB, gana todo el repechaje y vuelve a perder en la GF
    expect(podium.bronze).toEqual(['p3']);
    // todos pierden dos veces salvo el campeón (que no pierde) y el subcampeón (pierde 2 veces también)
    const losses: Record<string, number> = {};
    for (const m of live.filter((m) => m.status === 'FINISHED')) {
      const l = m.winnerId === m.redId ? m.blueId! : m.redId!;
      losses[l] = (losses[l] ?? 0) + 1;
    }
    expect(losses['p1']).toBeUndefined();
    for (const id of ids.slice(1)) expect(losses[id]).toBe(2);
  });
  it('2 participantes: solo una final', () => {
    const ms = generateBracket({ format: 'DOUBLE_ELIMINATION', participants: participants(2) });
    expect(ms).toHaveLength(1);
  });
});

describe('round robin', () => {
  it('5 participantes → 10 combates, cada uno enfrenta a todos', () => {
    const ms = generateBracket({ format: 'ROUND_ROBIN', participants: participants(5), random: rng() });
    expect(ms).toHaveLength(10);
    const count: Record<string, number> = {};
    for (const m of ms) {
      count[m.red!] = (count[m.red!] ?? 0) + 1;
      count[m.blue!] = (count[m.blue!] ?? 0) + 1;
    }
    expect(Object.values(count).every((c) => c === 4)).toBe(true);
    // ningún participante juega dos veces en la misma ronda
    const rounds = new Map<number, string[]>();
    for (const m of ms) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m.red!, m.blue!]);
    for (const list of rounds.values()) expect(new Set(list).size).toBe(list.length);
  });
  it('podio según tabla de posiciones', () => {
    const ids = participants(4).map((p) => p.id);
    const live = toLive(generateBracket({ format: 'ROUND_ROBIN', participants: participants(4), random: rng() }));
    playAll(live, applyResult);
    const podium = computePodium('ROUND_ROBIN', live, ids);
    expect(podium).toEqual({ gold: 'p1', silver: 'p2', bronze: ['p3'], complete: true });
  });
});
