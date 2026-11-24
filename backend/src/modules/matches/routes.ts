import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { idParam, matchStatusEnum } from '../../lib/schemas.js';
import { badRequest, forbidden } from '../../lib/errors.js';
import { matchOut } from '../brackets/dto.js';
import { matchInclude, recordResult, refreshCategoryStatus } from '../brackets/service.js';

const auditOut = z.object({
  id: z.string(), matchId: z.string(), createdAt: z.date(), reason: z.string().nullable(),
  user: z.object({ id: z.string(), name: z.string() }).nullable(),
  previousWinnerId: z.string().nullable(), previousMethodId: z.string().nullable(), previousStatus: z.string().nullable(),
  newWinnerId: z.string().nullable(), newMethodId: z.string().nullable(), newStatus: z.string().nullable(),
});

/** La mesa solo puede operar en los tatamis que tiene asignados. */
async function assertMatAccess(user: { id: string; role: string }, matId: string | null) {
  if (user.role === 'ADMIN') return;
  if (!matId) throw forbidden('El combate no tiene tatami asignado');
  const a = await prisma.matAssignment.findUnique({ where: { userId_matId: { userId: user.id, matId } } });
  if (!a) throw forbidden('No tienes asignado este tatami');
}

export const matchRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/matches/:id', { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, response: { 200: matchOut } } }, async (req) =>
    prisma.match.findUniqueOrThrow({ where: { id: req.params.id }, include: matchInclude }));

  app.get(
    '/mats/:id/matches',
    { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, querystring: z.object({ status: matchStatusEnum.optional() }), response: { 200: z.array(matchOut) } } },
    async (req) => {
      await assertMatAccess(req.user, req.params.id);
      return prisma.match.findMany({ where: { matId: req.params.id, status: req.query.status ?? { not: 'BYE' } }, include: matchInclude, orderBy: [{ matOrder: 'asc' }, { order: 'asc' }] });
    },
  );

  app.post('/matches/:id/start', { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, response: { 200: matchOut } } }, async (req) => {
    const m = await prisma.match.findUniqueOrThrow({ where: { id: req.params.id } });
    await assertMatAccess(req.user, m.matId);
    if (m.status !== 'PENDING') throw badRequest('Solo se puede iniciar un combate pendiente');
    if (!m.redId || !m.blueId) throw badRequest('El combate aún no tiene a los dos participantes');
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.match.update({ where: { id: m.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() }, include: matchInclude });
      await refreshCategoryStatus(tx, m.categoryId);
      return u;
    });
    return updated;
  });

  app.post('/matches/:id/cancel-start', { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, response: { 200: matchOut } } }, async (req) => {
    const m = await prisma.match.findUniqueOrThrow({ where: { id: req.params.id } });
    await assertMatAccess(req.user, m.matId);
    if (m.status !== 'IN_PROGRESS') throw badRequest('El combate no está en curso');
    return prisma.$transaction(async (tx) => {
      const u = await tx.match.update({ where: { id: m.id }, data: { status: 'PENDING', startedAt: null }, include: matchInclude });
      await refreshCategoryStatus(tx, m.categoryId);
      return u;
    });
  });

  /** Registrar resultado: solo ganador + método. Si ya estaba finalizado, es una corrección auditada. */
  app.post(
    '/matches/:id/result',
    { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, body: z.object({ winnerId: z.string().uuid(), victoryMethodId: z.string().uuid(), reason: z.string().max(500).optional() }), response: { 200: matchOut } } },
    async (req) => {
      const m = await prisma.match.findUniqueOrThrow({ where: { id: req.params.id } });
      await assertMatAccess(req.user, m.matId);
      return recordResult(m.id, req.body, req.user.id, req.user.role === 'ADMIN');
    },
  );

  /** Anular resultado (vuelve a pendiente). Solo admin. */
  app.post('/matches/:id/reset', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Combates'], params: idParam, body: z.object({ reason: z.string().max(500).optional() }), response: { 200: matchOut } } }, async (req) =>
    recordResult(req.params.id, { winnerId: null, victoryMethodId: null, reason: req.body.reason ?? 'Resultado anulado' }, req.user.id, true));

  app.get('/matches/:id/audit', { preHandler: [app.authenticate], schema: { tags: ['Combates'], params: idParam, response: { 200: z.array(auditOut) } } }, async (req) =>
    prisma.resultAudit.findMany({ where: { matchId: req.params.id }, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }));

  app.get('/tournaments/:id/audit', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Combates'], params: idParam, response: { 200: z.array(auditOut.extend({ match: z.object({ id: z.string(), label: z.string().nullable(), category: z.object({ id: z.string(), name: z.string() }) }) })) } } }, async (req) =>
    prisma.resultAudit.findMany({ where: { match: { category: { tournamentId: req.params.id } } }, include: { user: { select: { id: true, name: true } }, match: { select: { id: true, label: true, category: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 300 }));
};
