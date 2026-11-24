import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { idParam, okResponse } from '../../lib/schemas.js';
import { matchOut } from '../brackets/dto.js';
import { assignMatOrder, matchInclude } from '../brackets/service.js';
import { assertPublicTournament } from '../../lib/visibility.js';

const matOut = z.object({
  id: z.string(), tournamentId: z.string(), name: z.string(), order: z.number(), color: z.string().nullable(),
  assignments: z.array(z.object({ user: z.object({ id: z.string(), name: z.string(), email: z.string() }) })),
  categories: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), scheduledAt: z.date().nullable(), order: z.number(), _count: z.object({ matches: z.number(), registrations: z.number() }) })),
  _count: z.object({ matches: z.number() }),
});
const include = {
  assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
  categories: { select: { id: true, name: true, status: true, scheduledAt: true, order: true, _count: { select: { matches: true, registrations: true } } }, orderBy: [{ scheduledAt: 'asc' as const }, { order: 'asc' as const }] },
  _count: { select: { matches: true } },
};
const matBody = z.object({ name: z.string().min(1), order: z.number().int().default(0), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() });

export const matRoutes: FastifyPluginAsyncZod = async (app) => {
  const admin = [app.requireRole('ADMIN')];

  app.get('/tournaments/:id/mats', { preHandler: [app.authenticate], schema: { tags: ['Tatamis'], params: idParam, response: { 200: z.array(matOut) } } }, async (req) =>
    prisma.mat.findMany({ where: { tournamentId: req.params.id }, include, orderBy: { order: 'asc' } }));

  app.post('/tournaments/:id/mats', { preHandler: admin, schema: { tags: ['Tatamis'], params: idParam, body: matBody, response: { 201: matOut } } }, async (req, reply) =>
    reply.status(201).send(await prisma.mat.create({ data: { ...req.body, tournamentId: req.params.id }, include })));

  app.patch('/mats/:id', { preHandler: admin, schema: { tags: ['Tatamis'], params: idParam, body: matBody.partial(), response: { 200: matOut } } }, async (req) =>
    prisma.mat.update({ where: { id: req.params.id }, data: req.body, include }));

  app.delete('/mats/:id', { preHandler: admin, schema: { tags: ['Tatamis'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.mat.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /** Usuarios de mesa asignados a un tatami. */
  app.put('/mats/:id/users', { preHandler: admin, schema: { tags: ['Tatamis'], params: idParam, body: z.object({ userIds: z.array(z.string().uuid()) }), response: { 200: matOut } } }, async (req) => {
    await prisma.$transaction([
      prisma.matAssignment.deleteMany({ where: { matId: req.params.id } }),
      prisma.matAssignment.createMany({ data: req.body.userIds.map((userId) => ({ userId, matId: req.params.id })) }),
    ]);
    return prisma.mat.findUniqueOrThrow({ where: { id: req.params.id }, include });
  });

  /**
   * Programar categorías en un tatami: asigna tatami, hora y orden a cada categoría
   * y propaga a sus combates, recalculando la cola (matOrder).
   */
  app.put(
    '/tournaments/:id/schedule',
    {
      preHandler: admin,
      schema: { tags: ['Tatamis'], params: idParam, body: z.object({ items: z.array(z.object({ categoryId: z.string().uuid(), matId: z.string().uuid().nullable(), scheduledAt: z.string().nullable().optional(), order: z.number().int() })) }), response: { 200: okResponse } },
    },
    async (req) => {
      await prisma.$transaction(async (tx) => {
        const touchedMats = new Set<string>();
        for (const it of req.body.items) {
          const prev = await tx.category.findUniqueOrThrow({ where: { id: it.categoryId } });
          if (prev.matId) touchedMats.add(prev.matId);
          if (it.matId) touchedMats.add(it.matId);
          await tx.category.update({ where: { id: it.categoryId }, data: { matId: it.matId, order: it.order, scheduledAt: it.scheduledAt ? new Date(it.scheduledAt) : null } });
          await tx.match.updateMany({ where: { categoryId: it.categoryId }, data: { matId: it.matId, scheduledAt: it.scheduledAt ? new Date(it.scheduledAt) : null } });
        }
        for (const matId of touchedMats) await assignMatOrder(tx, matId);
      });
      return { ok: true };
    },
  );

  /** Mover un combate individual a otro tatami / posición. */
  app.patch('/matches/:id/schedule', { preHandler: admin, schema: { tags: ['Tatamis'], params: idParam, body: z.object({ matId: z.string().uuid().nullable(), matOrder: z.number().int().nullable().optional(), scheduledAt: z.string().nullable().optional() }), response: { 200: matchOut } } }, async (req) =>
    prisma.match.update({ where: { id: req.params.id }, data: { matId: req.body.matId, matOrder: req.body.matOrder ?? undefined, scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : req.body.scheduledAt === null ? null : undefined }, include: matchInclude }));

  /** Tablero en vivo de tatamis: combate en curso, siguientes y cuántos quedan. */
  app.get('/tournaments/:id/mats/live', { preHandler: [app.optionalAuth], schema: { tags: ['Tatamis'], security: [], params: idParam, response: { 200: z.array(z.object({ mat: z.object({ id: z.string(), name: z.string(), color: z.string().nullable(), order: z.number() }), current: matchOut.nullable(), upcoming: z.array(matchOut), remaining: z.number(), finished: z.number() })) } } }, async (req) => {
    await assertPublicTournament(req.params.id, req.user ?? null);
    return liveBoard(req.params.id);
  });
};

export async function liveBoard(tournamentId: string) {
  const mats = await prisma.mat.findMany({ where: { tournamentId }, orderBy: { order: 'asc' } });
  return Promise.all(
    mats.map(async (mat) => {
      const [current, upcoming, remaining, finished] = await Promise.all([
        prisma.match.findFirst({ where: { matId: mat.id, status: 'IN_PROGRESS' }, include: matchInclude, orderBy: { startedAt: 'desc' } }),
        prisma.match.findMany({ where: { matId: mat.id, status: 'PENDING', redId: { not: null }, blueId: { not: null } }, include: matchInclude, orderBy: [{ matOrder: 'asc' }, { order: 'asc' }], take: 5 }),
        prisma.match.count({ where: { matId: mat.id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
        prisma.match.count({ where: { matId: mat.id, status: 'FINISHED' } }),
      ]);
      return { mat: { id: mat.id, name: mat.name, color: mat.color, order: mat.order }, current, upcoming, remaining, finished };
    }),
  );
}
