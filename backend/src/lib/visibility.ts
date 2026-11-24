import { prisma } from './prisma.js';
import { notFound } from './errors.js';

/**
 * Los torneos en borrador no se exponen al público.
 * Si `user` es null (petición sin sesión válida) y el torneo está en DRAFT → 404.
 */
export async function assertPublicTournament(tournamentId: string, user: unknown) {
  if (user) return;
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { status: true } });
  if (!t || t.status === 'DRAFT') throw notFound('Torneo');
}

export async function assertPublicCategory(categoryId: string, user: unknown) {
  if (user) return;
  const c = await prisma.category.findUnique({ where: { id: categoryId }, select: { tournament: { select: { status: true } } } });
  if (!c || c.tournament.status === 'DRAFT') throw notFound('Categoría');
}
