export interface WeightRange {
  minKg: number | null;
  maxKg: number | null;
}

export type WeighInResult = 'OK' | 'OVERWEIGHT' | 'UNDERWEIGHT';

/** Valida un peso real contra el rango de la división. Rango inclusivo en ambos extremos. */
export function validateWeight(weightKg: number, range: WeightRange | null | undefined): WeighInResult {
  if (!range) return 'OK';
  if (range.maxKg != null && weightKg > range.maxKg + 1e-9) return 'OVERWEIGHT';
  if (range.minKg != null && weightKg < range.minKg - 1e-9) return 'UNDERWEIGHT';
  return 'OK';
}

export function weightInRange(weightKg: number, range: WeightRange): boolean {
  return validateWeight(weightKg, range) === 'OK';
}

/**
 * Edad competitiva: convención IBJJF — edad que cumple el atleta en el año del torneo.
 */
export function competitionAge(birthDate: Date, tournamentDate: Date): number {
  return tournamentDate.getUTCFullYear() - birthDate.getUTCFullYear();
}
