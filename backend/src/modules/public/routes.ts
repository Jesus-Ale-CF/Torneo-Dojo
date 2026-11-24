import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { idParam, matchStatusEnum, tournamentStatusEnum } from '../../lib/schemas.js';
import { notFound } from '../../lib/errors.js';
import { bracketOut, matchOut } from '../brackets/dto.js';
import { getBracket, matchInclude } from '../brackets/service.js';
import { assertPublicCategory, assertPublicTournament } from '../../lib/visibility.js';
import { categoryOut } from '../categories/routes.js';
import { categoryInclude } from '../categories/service.js';

const tOut = z.object({
  id: z.string(), name: z.string(), venue: z.string(), city: z.string().nullable(), startDate: z.date(), endDate: z.date(), status: tournamentStatusEnum, description: z.string().nullable(),
  sport: z.object({ id: z.string(), name: z.string(), slug: z.string(), victoryMethods: z.array(z.object({ id: z.string(), code: z.string(), name: z.string() })), beltLevels: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable(), order: z.number() })) }),
  mats: z.array(z.object({ id: z.string(), name: z.string(), color: z.string().nullable(), order: z.number() })),
  _count: z.object({ categories: z.number(), registrations: z.number() }),
});
const include = { sport: { include: { victoryMethods: { orderBy: { order: 'asc' as const } }, beltLevels: { orderBy: { order: 'asc' as const } } } }, mats: { orderBy: { order: 'asc' as const } }, _count: { select: { categories: true, registrations: true } } };

/** Rutas públicas (solo lectura, sin login). Los torneos en borrador no se exponen. */
export const publicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/tournaments', { schema: { tags: ['Público'], security: [], response: { 200: z.array(tOut) } } }, async () =>
    prisma.tournament.findMany({ where: { status: { not: 'DRAFT' } }, include, orderBy: [{ status: 'asc' }, { startDate: 'desc' }] }));

  app.get('/tournaments/:id', { schema: { tags: ['Público'], security: [], params: idParam, response: { 200: tOut } } }, async (req) => {
    const t = await prisma.tournament.findFirst({ where: { id: req.params.id, status: { not: 'DRAFT' } }, include });
    if (!t) throw notFound('Torneo');
    return t;
  });

  app.get('/tournaments/:id/categories', { schema: { tags: ['Público'], security: [], params: idParam, response: { 200: z.array(categoryOut) } } }, async (req) =>
    prisma.category.findMany({ where: { tournamentId: req.params.id, tournament: { status: { not: 'DRAFT' } } }, include: categoryInclude, orderBy: [{ order: 'asc' }, { name: 'asc' }] }));

  app.get('/categories/:id/bracket', { schema: { tags: ['Público'], security: [], params: idParam, response: { 200: bracketOut } } }, async (req) => {
    await assertPublicCategory(req.params.id, null);
    return getBracket(req.params.id);
  });

  app.get('/tournaments/:id/matches', { schema: { tags: ['Público'], security: [], params: idParam, querystring: z.object({ matId: z.string().uuid().optional(), status: matchStatusEnum.optional() }), response: { 200: z.array(matchOut) } } }, async (req) =>
    prisma.match.findMany({
      where: { category: { tournamentId: req.params.id, tournament: { status: { not: 'DRAFT' } } }, status: req.query.status ?? { not: 'BYE' }, ...(req.query.matId ? { matId: req.query.matId } : {}) },
      include: matchInclude, orderBy: [{ mat: { order: 'asc' } }, { matOrder: 'asc' }, { order: 'asc' }], take: 1000,
    }));
};
