import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { genderEnum, idParam, okResponse, weighInStatusEnum } from '../../lib/schemas.js';
import { badRequest } from '../../lib/errors.js';
import { findMatchingCategories } from '../categories/service.js';
import { validateWeight } from './weighin.js';

const regOut = z.object({
  id: z.string(), tournamentId: z.string(), athleteId: z.string(), categoryId: z.string().nullable(),
  declaredWeight: z.number().nullable(), weightKg: z.number().nullable(), weighInStatus: weighInStatusEnum, weighedAt: z.date().nullable(), seed: z.number().nullable(), notes: z.string().nullable(),
  athlete: z.object({
    id: z.string(), firstName: z.string(), lastName: z.string(), document: z.string(), birthDate: z.date(), gender: genderEnum,
    beltLevel: z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable() }).nullable(),
    academy: z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable() }).nullable(),
  }),
  category: z.object({ id: z.string(), name: z.string(), status: z.string(), weightDivision: z.object({ id: z.string(), name: z.string(), minKg: z.number().nullable(), maxKg: z.number().nullable() }).nullable() }).nullable(),
});
export const regInclude = {
  athlete: { include: { beltLevel: true, academy: { select: { id: true, name: true, abbreviation: true } } } },
  category: { select: { id: true, name: true, status: true, weightDivision: true } },
} as const;
const suggestionOut = z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), weightDivision: z.object({ id: z.string(), name: z.string(), minKg: z.number().nullable(), maxKg: z.number().nullable() }).nullable(), _count: z.object({ registrations: z.number() }) }));

async function assertCategoryOpen(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const c = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
  if (c.status !== 'OPEN') throw badRequest(`La categoría "${c.name}" ya tiene llave generada; elimina la llave para modificar sus inscritos`);
}

export const registrationRoutes: FastifyPluginAsyncZod = async (app) => {
  const admin = [app.requireRole('ADMIN')];

  app.get('/tournaments/:id/registrations', { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, querystring: z.object({ categoryId: z.string().uuid().optional(), status: weighInStatusEnum.optional() }), response: { 200: z.array(regOut) } } }, async (req) =>
    prisma.registration.findMany({
      where: { tournamentId: req.params.id, ...(req.query.categoryId ? { categoryId: req.query.categoryId } : {}), ...(req.query.status ? { weighInStatus: req.query.status } : {}) },
      include: regInclude, orderBy: [{ athlete: { lastName: 'asc' } }, { athlete: { firstName: 'asc' } }],
    }));

  app.post(
    '/tournaments/:id/registrations',
    { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, body: z.object({ athleteId: z.string().uuid(), categoryId: z.string().uuid().nullable().optional(), declaredWeight: z.number().positive().nullable().optional(), autoAssign: z.boolean().default(true) }), response: { 201: regOut } } },
    async (req, reply) => {
      const { athleteId, declaredWeight, autoAssign } = req.body;
      let categoryId = req.body.categoryId ?? null;
      await assertCategoryOpen(categoryId);
      if (!categoryId && autoAssign) {
        const athlete = await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId } });
        const matches = await findMatchingCategories(req.params.id, athlete, declaredWeight ?? null);
        if (matches.length === 1) categoryId = matches[0].id;
      }
      const reg = await prisma.registration.create({ data: { tournamentId: req.params.id, athleteId, categoryId, declaredWeight: declaredWeight ?? null }, include: regInclude });
      return reply.status(201).send(reg);
    },
  );

  app.patch(
    '/registrations/:id',
    { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, body: z.object({ categoryId: z.string().uuid().nullable().optional(), declaredWeight: z.number().positive().nullable().optional(), seed: z.number().int().positive().nullable().optional(), notes: z.string().nullable().optional(), weighInStatus: weighInStatusEnum.optional() }), response: { 200: regOut } } },
    async (req) => {
      const current = await prisma.registration.findUniqueOrThrow({ where: { id: req.params.id }, include: { category: { include: { weightDivision: true } } } });
      if (req.body.categoryId !== undefined && req.body.categoryId !== current.categoryId) {
        await assertCategoryOpen(current.categoryId);
        await assertCategoryOpen(req.body.categoryId);
      }
      // si cambia de categoría y ya fue pesado, revalidar
      let weighInStatus = req.body.weighInStatus;
      if (!weighInStatus && req.body.categoryId && current.weightKg != null && current.weighInStatus !== 'DISQUALIFIED') {
        const cat = await prisma.category.findUniqueOrThrow({ where: { id: req.body.categoryId }, include: { weightDivision: true } });
        weighInStatus = validateWeight(current.weightKg, cat.weightDivision);
      }
      return prisma.registration.update({ where: { id: req.params.id }, data: { ...req.body, weighInStatus }, include: regInclude });
    },
  );

  app.delete('/registrations/:id', { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    const current = await prisma.registration.findUniqueOrThrow({ where: { id: req.params.id } });
    await assertCategoryOpen(current.categoryId);
    await prisma.registration.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /** Categorías sugeridas para una inscripción (opcionalmente con un peso dado). */
  app.get('/registrations/:id/suggestions', { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, querystring: z.object({ weightKg: z.coerce.number().optional() }), response: { 200: suggestionOut } } }, async (req) => {
    const reg = await prisma.registration.findUniqueOrThrow({ where: { id: req.params.id }, include: { athlete: true } });
    const w = req.query.weightKg ?? reg.weightKg ?? reg.declaredWeight ?? null;
    const cats = await findMatchingCategories(reg.tournamentId, reg.athlete, w);
    return cats.filter((c) => c.status === 'OPEN').map((c) => ({ id: c.id, name: c.name, status: c.status, weightDivision: c.weightDivision, _count: { registrations: c._count.registrations } }));
  });

  /**
   * Registro de pesaje. Valida contra la división de la categoría.
   * Devuelve el estado y, si no cumple, categorías sugeridas.
   */
  app.post(
    '/registrations/:id/weigh-in',
    { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, body: z.object({ weightKg: z.number().positive().max(400) }), response: { 200: z.object({ registration: regOut, status: weighInStatusEnum, suggestions: suggestionOut }) } } },
    async (req) => {
      const reg = await prisma.registration.findUniqueOrThrow({ where: { id: req.params.id }, include: { athlete: true, category: { include: { weightDivision: true } } } });
      const status = validateWeight(req.body.weightKg, reg.category?.weightDivision);
      const updated = await prisma.registration.update({ where: { id: reg.id }, data: { weightKg: req.body.weightKg, weighedAt: new Date(), weighInStatus: status }, include: regInclude });
      let suggestions: z.infer<typeof suggestionOut> = [];
      if (status !== 'OK') {
        const cats = await findMatchingCategories(reg.tournamentId, reg.athlete, req.body.weightKg);
        suggestions = cats.filter((c) => c.status === 'OPEN' && c.id !== reg.categoryId).map((c) => ({ id: c.id, name: c.name, status: c.status, weightDivision: c.weightDivision, _count: { registrations: c._count.registrations } }));
      }
      return { registration: updated, status, suggestions };
    },
  );

  app.post('/registrations/:id/disqualify', { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, body: z.object({ notes: z.string().optional() }), response: { 200: regOut } } }, async (req) =>
    prisma.registration.update({ where: { id: req.params.id }, data: { weighInStatus: 'DISQUALIFIED', notes: req.body.notes }, include: regInclude }));

  app.post('/registrations/:id/auto-assign', { preHandler: admin, schema: { tags: ['Inscripciones'], params: idParam, response: { 200: z.object({ registration: regOut, candidates: suggestionOut }) } } }, async (req) => {
    const reg = await prisma.registration.findUniqueOrThrow({ where: { id: req.params.id }, include: { athlete: true } });
    const cats = (await findMatchingCategories(reg.tournamentId, reg.athlete, reg.weightKg ?? reg.declaredWeight ?? null)).filter((c) => c.status === 'OPEN');
    const candidates = cats.map((c) => ({ id: c.id, name: c.name, status: c.status, weightDivision: c.weightDivision, _count: { registrations: c._count.registrations } }));
    if (cats.length === 1) {
      await assertCategoryOpen(reg.categoryId);
      const updated = await prisma.registration.update({ where: { id: reg.id }, data: { categoryId: cats[0].id }, include: regInclude });
      return { registration: updated, candidates };
    }
    const current = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id }, include: regInclude });
    return { registration: current, candidates };
  });
};
