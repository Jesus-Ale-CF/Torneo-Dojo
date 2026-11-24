import type { Podium } from '../brackets/podium.js';

export interface MedalPoints {
  gold: number;
  silver: number;
  bronze: number;
}

export interface AcademyRow {
  academyId: string;
  academyName: string;
  gold: number;
  silver: number;
  bronze: number;
  points: number;
  rank: number;
}

export interface PodiumEntry {
  categoryId: string;
  podium: Podium;
}

/**
 * Medallero por academia a partir de los podios de cada categoría.
 * Orden: puntos desc, luego oro, plata, bronce desc.
 */
export function computeMedalTable(
  podiums: PodiumEntry[],
  academyOf: (participantId: string) => { id: string; name: string } | null,
  points: MedalPoints,
): AcademyRow[] {
  const rows = new Map<string, AcademyRow>();
  const add = (pid: string | null, medal: 'gold' | 'silver' | 'bronze') => {
    if (!pid) return;
    const ac = academyOf(pid);
    if (!ac) return;
    const row = rows.get(ac.id) ?? { academyId: ac.id, academyName: ac.name, gold: 0, silver: 0, bronze: 0, points: 0, rank: 0 };
    row[medal]++;
    row.points += points[medal];
    rows.set(ac.id, row);
  };
  for (const { podium } of podiums) {
    if (!podium.complete) continue;
    add(podium.gold, 'gold');
    add(podium.silver, 'silver');
    for (const b of podium.bronze) add(b, 'bronze');
  }
  const list = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.academyName.localeCompare(b.academyName),
  );
  list.forEach((r, i) => (r.rank = i + 1));
  return list;
}
