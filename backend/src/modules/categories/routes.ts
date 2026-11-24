import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { bracketFormatEnum, genderEnum, idParam, okResponse } from '../../lib/schemas.js';
import { badRequest } from '../../lib/errors.js';
import { buildCategoryName, categoryInclude } from './service.js';

const beltOut = z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable(), order: z.number() });
export const categoryOut = z.object({
  id: z.string(), tournamentId: z.string(), name: z.string(), gender: genderEnum,
  weightDivision: z.object({ id: z.string(), name: z.string(), minKg: z.number().nullable(), maxKg: z.number().nullable() }).nullable(),
  ageGroup: z.object({ id: z.string(), name: z.string(), minAge: z.number(), maxAge: z.number() }).nullable(),
  beltLevel: beltOut.nullable(),
  belts: z.array(z.object({ belt: beltOut })),
  format: bracketFormatEnum, status: z.enum(['OPEN', 'BRACKET_READY', 'IN_PROGRESS', 'FINISHED']),
  avoidSameAcademy: z.boolean(), tiebreakRules: z.string(), matId: z.string().nullable(), mat: z.object({ id: z.string(), name: z.string() }).nullable(),
  scheduledAt: z.date().nullable(), order: z.number(), durationSec: z.number().nullable(),
  _count: z.object({ registrations: z.number(), matches: z.number() }),
});
const categoryBody = z.object({
  name: z.string().min(1).optional(), gender: genderEnum, weightDivisionId: z.string().uuid().nullable().optional(), ageGroupId: z.string().uuid().nullable().optional(),
  beltLevelId: z.string().uuid().nullable().optional(), beltIds: z.array(z.string().uuid()).optional(), format: bracketFormatEnum.default('SINGLE_ELIMINATION'),
  avoidSameAcademy: z.boolean().default(true), tiebreakRules: z.string().default('WINS,HEAD_TO_HEAD,METHOD_POINTS,DRAW'),
  matId: z.string().uuid().nullable().optional(), scheduledAt: z.string().nullable().optional(), order: z.number().int().default(0), durationSec: z.number().int().nullable().optional(),
});

async function resolveName(body: z.infer<typeof categoryBody>) {
  if (body.name) return body.name;
  const [div, age, belt] = await Promise.all([
    body.weightDivisionId ? prisma.weightDivision.findUnique({ where: { id: body.weightDivisionId } }) : null,
    body.ageGroupId ? prisma.ageGroup.findUnique({ where: { id: body.ageGroupId } }) : null,
    body.beltLevelId ? prisma.beltLevel.findUnique({ where: { id: body.beltLevelId } }) : null,
  ]);
  return buildCategoryName({ ageGroup: age?.name, gender: body.gender, belt: belt?.name, division: div?.name });
}

export const categoryRoutes: FastifyPluginAsyncZod = async (app) => {
  const admin = [app.requireRole('ADMIN')];

  app.get('/tournaments/:id/categories', { preHandler: [app.authenticate], schema: { tags: ['Categorías'], params: idParam, response: { 200: z.array(categoryOut) } } }, async (req) =>
    prisma.category.findMany({ where: { tournamentId: req.params.id }, include: categoryInclude, orderBy: [{ order: 'asc' }, { name: 'asc' }] }));

  app.get('/categories/:id', { preHandler: [app.authenticate], schema: { tags: ['Categorías'], params: idParam, response: { 200: categoryOut } } }, async (req) =>
    prisma.category.findUniqueOrThrow({ where: { id: req.params.id }, include: categoryInclude }));

  app.post('/tournaments/:id/categories', { preHandler: admin, schema: { tags: ['Categorías'], params: idParam, body: categoryBody, response: { 201: categoryOut } } }, async (req, reply) => {
    const { beltIds = [], scheduledAt, ...data } = req.body;
    const name = await resolveName(req.body);
    const cat = await prisma.category.create({
      data: { ...data, name, tournamentId: req.params.id, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, belts: { create: beltIds.map((beltId) => ({ beltId })) } },
      include: categoryInclude,
    });
    return reply.status(201).send(cat);
  });

  /**
   * Generación asistida: combina grupos de edad × géneros × cinturones × divisiones.
   * Omite combinaciones ya existentes.
   */
  app.post(
    '/tournaments/:id/categories/generate',
    {
      preHandler: admin,
      schema: {
        tags: ['Categorías'], params: idParam,
        body: z.object({ ageGroupIds: z.array(z.string().uuid()), genders: z.array(genderEnum).min(1), beltLevelIds: z.array(z.string().uuid()), weightDivisionIds: z.array(z.string().uuid()), format: bracketFormatEnum.default('SINGLE_ELIMINATION') }),
        response: { 200: z.object({ created: z.number(), skipped: z.number() }) },
      },
    },
    async (req) => {
      const tid = req.params.id;
      const { ageGroupIds, genders, beltLevelIds, weightDivisionIds, format } = req.body;
      const [ages, belts, divs, existing] = await Promise.all([
        prisma.ageGroup.findMany({ where: { id: { in: ageGroupIds } } }),
        prisma.beltLevel.findMany({ where: { id: { in: beltLevelIds } } }),
        prisma.weightDivision.findMany({ where: { id: { in: weightDivisionIds } } }),
        prisma.category.findMany({ where: { tournamentId: tid } }),
      ]);
      const key = (a: string | null, g: string, b: string | null, d: string | null) => `${a}|${g}|${b}|${d}`;
      const seen = new Set(existing.map((c) => key(c.ageGroupId, c.gender, c.beltLevelId, c.weightDivisionId)));
      const agesOrNull = ages.length ? ages : [null];
      const beltsOrNull = belts.length ? belts : [null];
      const divsOrNull = divs.length ? divs : [null];
      let created = 0;
      let skipped = 0;
      const rows: Prisma.CategoryCreateManyInput[] = [];
      let order = existing.length;
      for (const a of agesOrNull) for (const g of genders) for (const b of beltsOrNull) for (const d of divsOrNull) {
        if (d?.gender && d.gender !== g) continue;
        const k = key(a?.id ?? null, g, b?.id ?? null, d?.id ?? null);
        if (seen.has(k)) { skipped++; continue; }
        seen.add(k);
        rows.push({ tournamentId: tid, name: buildCategoryName({ ageGroup: a?.name, gender: g, belt: b?.name, division: d?.name }), gender: g, ageGroupId: a?.id ?? null, beltLevelId: b?.id ?? null, weightDivisionId: d?.id ?? null, format, order: order++ });
        created++;
      }
      if (rows.length) await prisma.category.createMany({ data: rows });
      return { created, skipped };
    },
  );

  app.patch('/categories/:id', { preHandler: admin, schema: { tags: ['Categorías'], params: idParam, body: categoryBody.partial(), response: { 200: categoryOut } } }, async (req) => {
    const { beltIds, scheduledAt, ...data } = req.body;
    const current = await prisma.category.findUniqueOrThrow({ where: { id: req.params.id } });
    const changes = (k: 'format' | 'weightDivisionId' | 'ageGroupId' | 'beltLevelId' | 'gender') => data[k] !== undefined && (data[k] ?? null) !== (current[k] ?? null);
    const beltsChanged = beltIds !== undefined && (await prisma.categoryBelt.count({ where: { categoryId: current.id } })) !== beltIds.length;
    if (current.status !== 'OPEN' && (changes('format') || changes('weightDivisionId') || changes('ageGroupId') || changes('beltLevelId') || changes('gender') || beltsChanged)) {
      throw badRequest('No se puede cambiar la configuración de una categoría con llave generada. Elimina la llave primero.');
    }
    return prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
        ...(beltIds ? { belts: { deleteMany: {}, create: beltIds.map((beltId) => ({ beltId })) } } : {}),
      },
      include: categoryInclude,
    });
  });

  app.delete('/categories/:id', { preHandler: admin, schema: { tags: ['Categorías'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    const started = await prisma.match.count({ where: { categoryId: req.params.id, status: { in: ['IN_PROGRESS', 'FINISHED'] } } });
    if (started) throw badRequest('La categoría tiene combates iniciados o finalizados y no puede eliminarse');
    await prisma.category.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  app.delete('/tournaments/:id/categories/empty', { preHandler: admin, schema: { tags: ['Categorías'], params: idParam, response: { 200: z.object({ deleted: z.number() }) } } }, async (req) => {
    const r = await prisma.category.deleteMany({ where: { tournamentId: req.params.id, registrations: { none: {} }, matches: { none: {} } } });
    return { deleted: r.count };
  });
};
