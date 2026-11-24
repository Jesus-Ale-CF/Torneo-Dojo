import { prisma } from '../../lib/prisma.js';
import { computePodium } from '../brackets/podium.js';
import { toLive } from '../brackets/service.js';
import { computeMedalTable } from './calc.js';

export async function tournamentMedals(tournamentId: string) {
  const t = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId }, include: { sport: { include: { victoryMethods: true } } } });
  const categories = await prisma.category.findMany({
    where: { tournamentId },
    include: {
      matches: true,
      registrations: { include: { athlete: { include: { academy: true, beltLevel: true } } } },
      weightDivision: true, ageGroup: true, beltLevel: true,
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  const methodPoints = Object.fromEntries(t.sport.victoryMethods.map((m) => [m.id, m.points]));
  const regIndex = new Map<string, (typeof categories)[number]['registrations'][number]>();
  for (const c of categories) for (const r of c.registrations) regIndex.set(r.id, r);

  const podiums = categories.map((c) => {
    const ids = c.registrations.filter((r) => r.weighInStatus !== 'DISQUALIFIED').map((r) => r.id);
    const podium = computePodium(c.format, c.matches.map(toLive), ids, { tiebreakRules: c.tiebreakRules, methodPoints, drawOrder: ids });
    return { categoryId: c.id, podium };
  });
  const toEntry = (id: string | null) => {
    if (!id) return null;
    const r = regIndex.get(id);
    if (!r) return null;
    return { registrationId: r.id, athlete: { id: r.athlete.id, firstName: r.athlete.firstName, lastName: r.athlete.lastName, academy: r.athlete.academy ? { id: r.athlete.academy.id, name: r.athlete.academy.name, abbreviation: r.athlete.academy.abbreviation } : null, beltLevel: r.athlete.beltLevel ? { id: r.athlete.beltLevel.id, name: r.athlete.beltLevel.name, color: r.athlete.beltLevel.color, secondary: r.athlete.beltLevel.secondary } : null } };
  };
  const byCategory = categories.map((c, i) => ({
    category: { id: c.id, name: c.name, status: c.status, format: c.format },
    complete: podiums[i].podium.complete,
    gold: toEntry(podiums[i].podium.gold),
    silver: toEntry(podiums[i].podium.silver),
    bronze: podiums[i].podium.bronze.map(toEntry).filter((x): x is NonNullable<typeof x> => !!x),
  }));
  const academies = computeMedalTable(
    podiums,
    (pid) => {
      const a = regIndex.get(pid)?.athlete.academy;
      return a ? { id: a.id, name: a.name } : null;
    },
    { gold: t.pointsGold, silver: t.pointsSilver, bronze: t.pointsBronze },
  );
  return { tournament: { id: t.id, name: t.name, pointsGold: t.pointsGold, pointsSilver: t.pointsSilver, pointsBronze: t.pointsBronze }, byCategory, academies };
}
