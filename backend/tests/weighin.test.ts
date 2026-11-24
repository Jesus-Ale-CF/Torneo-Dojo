import { describe, expect, it } from 'vitest';
import { validateWeight, competitionAge } from '../src/modules/registrations/weighin.js';

describe('pesaje', () => {
  const pluma = { minKg: 64.1, maxKg: 70 };
  it('dentro del rango', () => expect(validateWeight(68, pluma)).toBe('OK'));
  it('límite superior inclusivo', () => expect(validateWeight(70, pluma)).toBe('OK'));
  it('límite inferior inclusivo', () => expect(validateWeight(64.1, pluma)).toBe('OK'));
  it('sobrepeso', () => expect(validateWeight(70.3, pluma)).toBe('OVERWEIGHT'));
  it('bajo peso', () => expect(validateWeight(60, pluma)).toBe('UNDERWEIGHT'));
  it('absoluto (sin máximo)', () => expect(validateWeight(120, { minKg: null, maxKg: null })).toBe('OK'));
  it('sin división → OK', () => expect(validateWeight(50, null)).toBe('OK'));
  it('edad competitiva por año', () => {
    expect(competitionAge(new Date('1990-12-31'), new Date('2026-03-01'))).toBe(36);
    expect(competitionAge(new Date('2010-01-01'), new Date('2026-11-09'))).toBe(16);
  });
});
