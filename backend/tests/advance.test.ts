import { describe, expect, it } from 'vitest';
import { generateBracket } from '../src/modules/brackets/generator.js';
import { applyResult } from '../src/modules/brackets/advance.js';
import { participants, rng, toLive } from './helpers.js';

describe('avance de ganadores', () => {
  it('el ganador pasa al slot correcto de la siguiente ronda', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(4), random: rng(), avoidSameAcademy: false }));
    const r1 = live.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
    const final = live.find((m) => m.round === 2)!;
    applyResult(live, r1[0].id, r1[0].redId!, 'm');
    expect(final.redId).toBe(r1[0].redId);
    expect(final.blueId).toBeNull();
    applyResult(live, r1[1].id, r1[1].blueId!, 'm');
    expect(final.blueId).toBe(r1[1].blueId);
    expect(final.status).toBe('PENDING');
  });
  it('rechaza un ganador que no participa en el combate', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(4), random: rng() }));
    expect(() => applyResult(live, live[0].id, 'zzz', 'm')).toThrow();
  });
  it('corregir un resultado invalida los combates posteriores afectados', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(4), random: rng(), avoidSameAcademy: false }));
    const r1 = live.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
    const final = live.find((m) => m.round === 2)!;
    applyResult(live, r1[0].id, r1[0].redId!, 'm');
    applyResult(live, r1[1].id, r1[1].redId!, 'm');
    applyResult(live, final.id, final.redId!, 'm');
    expect(final.status).toBe('FINISHED');
    // corrección: en el combate 1 ganó el azul
    const changes = applyResult(live, r1[0].id, r1[0].blueId!, 'm');
    expect(final.status).toBe('PENDING');
    expect(final.winnerId).toBeNull();
    expect(final.redId).toBe(r1[0].blueId);
    expect(changes.find((c) => c.id === final.id)?.invalidated).toBe(true);
  });
  it('corregir sin cambiar participantes posteriores no invalida nada', () => {
    const live = toLive(generateBracket({ format: 'SINGLE_ELIMINATION', participants: participants(4), random: rng(), avoidSameAcademy: false }));
    const r1 = live.filter((m) => m.round === 1).sort((a, b) => a.position - b.position);
    const final = live.find((m) => m.round === 2)!;
    applyResult(live, r1[0].id, r1[0].redId!, 'm1');
    applyResult(live, r1[1].id, r1[1].redId!, 'm1');
    applyResult(live, final.id, final.redId!, 'm1');
    const changes = applyResult(live, r1[0].id, r1[0].redId!, 'm2'); // solo cambia el método
    expect(final.status).toBe('FINISHED');
    expect(changes.some((c) => c.invalidated)).toBe(false);
  });
  it('en doble eliminación el perdedor baja al repechaje', () => {
    const live = toLive(generateBracket({ format: 'DOUBLE_ELIMINATION', participants: participants(4), random: rng(), avoidSameAcademy: false }));
    const w1 = live.filter((m) => m.side === 'WINNERS' && m.round === 1).sort((a, b) => a.position - b.position);
    const l1 = live.find((m) => m.side === 'LOSERS' && m.round === 1)!;
    applyResult(live, w1[0].id, w1[0].redId!, 'm');
    expect(l1.redId).toBe(w1[0].blueId);
    applyResult(live, w1[1].id, w1[1].blueId!, 'm');
    expect(l1.blueId).toBe(w1[1].redId);
  });
  it('un BYE encadenado se recalcula si cambia su participante', () => {
    // 3 participantes doble eliminación: hay BYEs en WB r1 y LB
    const live = toLive(generateBracket({ format: 'DOUBLE_ELIMINATION', participants: participants(3), random: rng(3) }));
    const real = live.find((m) => m.status === 'PENDING' && m.redId && m.blueId)!;
    applyResult(live, real.id, real.redId!, 'm');
    const corrected = applyResult(live, real.id, real.blueId!, 'm');
    expect(corrected.length).toBeGreaterThan(0);
    // ningún combate finalizado queda inconsistente
    for (const m of live.filter((x) => x.status === 'FINISHED')) expect([m.redId, m.blueId]).toContain(m.winnerId);
  });
});
