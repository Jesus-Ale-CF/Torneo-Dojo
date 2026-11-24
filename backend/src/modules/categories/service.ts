import type { Gender } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { competitionAge, weightInRange } from '../registrations/weighin.js';

export const GENDER_LABEL: Record<Gender, string> = { M: 'Masculino', F: 'Femenino', X: 'Mixto' };

export function buildCategoryName(parts: { ageGroup?: string | null; gender: Gender; belt?: string | null; division?: string | null }): string {
  return [parts.ageGroup, GENDER_LABEL[parts.gender], parts.belt, parts.division].filter(Boolean).join(' · ');
}

export const categoryInclude = {
  weightDivision: true,
  ageGroup: true,
  beltLevel: true,
  belts: { include: { belt: true } },
  mat: { select: { id: true, name: true } },
  _count: { select: { registrations: true, matches: true } },
} as const;

/**
 * Categorías del torneo compatibles con un atleta (género, edad, cinturón y peso opcional).
 * Devuelve ordenadas: primero las que coinciden exactamente en peso.
 */
export async function findMatchingCategories(
  tournamentId: string,
  athlete: { birthDate: Date; gender: Gender; beltLevelId: string | null },
  weightKg: number | null,
) {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const age = competitionAge(athlete.birthDate, tournament.startDate);
  const cats = await prisma.category.findMany({ where: { tournamentId }, include: categoryInclude });
  return cats.filter((c) => {
    if (c.gender !== 'X' && c.gender !== athlete.gender) return false;
    if (c.ageGroup && (age < c.ageGroup.minAge || age > c.ageGroup.maxAge)) return false;
    const beltIds = [c.beltLevelId, ...c.belts.map((b) => b.beltId)].filter(Boolean) as string[];
    if (beltIds.length && (!athlete.beltLevelId || !beltIds.includes(athlete.beltLevelId))) return false;
    if (weightKg != null && c.weightDivision && !weightInRange(weightKg, c.weightDivision)) return false;
    if (c.weightDivision?.gender && c.weightDivision.gender !== athlete.gender) return false;
    return true;
  });
}
