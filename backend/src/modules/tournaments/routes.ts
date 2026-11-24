import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { dateString, genderEnum, idParam, okResponse, tournamentStatusEnum } from '../../lib/schemas.js';
import { optionalText } from '../../lib/zod-es.js';
import { fieldErrors } from '../../lib/errors.js';

function assertDates(start?: string, end?: string) {
  if (start && end && new Date(end) < new Date(start)) throw fieldErrors({ endDate: 'La fecha de fin no puede ser anterior a la de inicio' });
}

const tournamentOut = z.object({
  id: z.string(), name: z.string(), venue: z.string(), city: z.string().nullable(), startDate: z.date(), endDate: z.date(),
  status: tournamentStatusEnum, sportId: z.string(), sport: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  pointsGold: z.number(), pointsSilver: z.number(), pointsBronze: z.number(), description: z.string().nullable(),
  _count: z.object({ categories: z.number(), registrations: z.number(), mats: z.number() }),
});
const include = { sport: { select: { id: true, name: true, slug: true } }, _count: { select: { categories: true, registrations: true, mats: true } } };
const tournamentBody = z.object({
  name: z.string().trim().min(3).max(120), venue: z.string().trim().min(2).max(120), city: optionalText(80), startDate: dateString, endDate: dateString,
  sportId: z.string().uuid(), status: tournamentStatusEnum.optional(), pointsGold: z.number().int().min(0).default(9),
  pointsSilver: z.number().int().min(0).default(3), pointsBronze: z.number().int().min(0).default(1), description: optionalText(2000),
});
const divOut = z.object({ id: z.string(), name: z.string(), minKg: z.number().nullable(), maxKg: z.number().nullable(), gender: genderEnum.nullable(), order: z.number() });
const divIn = z.object({ name: z.string().min(1), minKg: z.number().min(0).nullable().optional(), maxKg: z.number().min(0).nullable().optional(), gender: genderEnum.nullable().optional(), order: z.number().int().default(0) });
const ageOut = z.object({ id: z.string(), name: z.string(), minAge: z.number(), maxAge: z.number(), order: z.number() });
const ageIn = z.object({ name: z.string().min(1), minAge: z.number().int().min(0), maxAge: z.number().int().min(0), order: z.number().int().default(0) });

export const tournamentRoutes: FastifyPluginAsyncZod = async (app) => {
  const admin = [app.requireRole('ADMIN')];

  app.get('/', { preHandler: [app.authenticate], schema: { tags: ['Torneos'], response: { 200: z.array(tournamentOut) } } }, async () =>
    prisma.tournament.findMany({ include, orderBy: { startDate: 'desc' } }));

  app.get('/:id', { preHandler: [app.authenticate], schema: { tags: ['Torneos'], params: idParam, response: { 200: tournamentOut } } }, async (req) =>
    prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include }));

  app.post('/', { preHandler: admin, schema: { tags: ['Torneos'], body: tournamentBody, response: { 201: tournamentOut } } }, async (req, reply) => {
    assertDates(req.body.startDate, req.body.endDate);
    const t = await prisma.tournament.create({ data: { ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) }, include });
    return reply.status(201).send(t);
  });

  app.patch('/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: tournamentBody.partial(), response: { 200: tournamentOut } } }, async (req) => {
    const { startDate, endDate, ...rest } = req.body;
    if (startDate || endDate) {
      const cur = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
      assertDates(startDate ?? cur.startDate.toISOString(), endDate ?? cur.endDate.toISOString());
    }
    return prisma.tournament.update({
      where: { id: req.params.id },
      data: { ...rest, ...(startDate ? { startDate: new Date(startDate) } : {}), ...(endDate ? { endDate: new Date(endDate) } : {}) },
      include,
    });
  });

  app.delete('/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.tournament.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /* ------------------------------ divisiones de peso ------------------------------ */
  app.get('/:id/weight-divisions', { preHandler: [app.authenticate], schema: { tags: ['Torneos'], params: idParam, response: { 200: z.array(divOut) } } }, async (req) =>
    prisma.weightDivision.findMany({ where: { tournamentId: req.params.id }, orderBy: [{ order: 'asc' }, { maxKg: 'asc' }] }));

  app.post('/:id/weight-divisions', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: divIn, response: { 201: divOut } } }, async (req, reply) =>
    reply.status(201).send(await prisma.weightDivision.create({ data: { ...req.body, tournamentId: req.params.id } })));

  app.put('/:id/weight-divisions/bulk', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: z.array(divIn), response: { 200: z.array(divOut) } } }, async (req) => {
    await prisma.$transaction([
      prisma.weightDivision.deleteMany({ where: { tournamentId: req.params.id, categories: { none: {} } } }),
      prisma.weightDivision.createMany({ data: req.body.map((d, i) => ({ ...d, order: d.order || i, tournamentId: req.params.id })) }),
    ]);
    return prisma.weightDivision.findMany({ where: { tournamentId: req.params.id }, orderBy: [{ order: 'asc' }, { maxKg: 'asc' }] });
  });

  app.patch('/weight-divisions/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: divIn.partial(), response: { 200: divOut } } }, async (req) =>
    prisma.weightDivision.update({ where: { id: req.params.id }, data: req.body }));

  app.delete('/weight-divisions/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.weightDivision.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /* ------------------------------ grupos de edad ------------------------------ */
  app.get('/:id/age-groups', { preHandler: [app.authenticate], schema: { tags: ['Torneos'], params: idParam, response: { 200: z.array(ageOut) } } }, async (req) =>
    prisma.ageGroup.findMany({ where: { tournamentId: req.params.id }, orderBy: [{ order: 'asc' }, { minAge: 'asc' }] }));

  app.post('/:id/age-groups', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: ageIn, response: { 201: ageOut } } }, async (req, reply) =>
    reply.status(201).send(await prisma.ageGroup.create({ data: { ...req.body, tournamentId: req.params.id } })));

  app.patch('/age-groups/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, body: ageIn.partial(), response: { 200: ageOut } } }, async (req) =>
    prisma.ageGroup.update({ where: { id: req.params.id }, data: req.body }));

  app.delete('/age-groups/:id', { preHandler: admin, schema: { tags: ['Torneos'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.ageGroup.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
};
