import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { idParam, okResponse } from '../../lib/schemas.js';
import { optionalText } from '../../lib/zod-es.js';

const methodIn = z.object({ id: z.string().uuid().optional(), code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_]+$/, 'Solo letras, números y guion bajo').toUpperCase(), name: z.string().trim().min(1).max(60), order: z.number().int().default(0), points: z.number().int().min(0).max(100).default(1) });
const beltIn = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(), order: z.number().int().default(0) });
const sportOut = z.object({
  id: z.string(), name: z.string(), slug: z.string(), defaultDurationSec: z.number(), description: z.string().nullable(),
  victoryMethods: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), order: z.number(), points: z.number() })),
  beltLevels: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable(), order: z.number() })),
  _count: z.object({ tournaments: z.number() }).optional(),
});
const include = { victoryMethods: { orderBy: { order: 'asc' as const } }, beltLevels: { orderBy: { order: 'asc' as const } }, _count: { select: { tournaments: true } } };
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const sportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: [app.optionalAuth], schema: { tags: ['Deportes'], security: [], response: { 200: z.array(sportOut) } } }, async () => prisma.sport.findMany({ include, orderBy: { name: 'asc' } }));

  app.get('/:id', { schema: { tags: ['Deportes'], security: [], params: idParam, response: { 200: sportOut } } }, async (req) => prisma.sport.findUniqueOrThrow({ where: { id: req.params.id }, include }));

  app.post(
    '/',
    { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Deportes'], body: z.object({ name: z.string().trim().min(2).max(60), defaultDurationSec: z.number().int().min(30).max(3600).default(300), description: optionalText(1000), victoryMethods: z.array(methodIn).min(1).default([]), beltLevels: z.array(beltIn).default([]) }), response: { 201: sportOut } } },
    async (req, reply) => {
      const { victoryMethods, beltLevels, ...data } = req.body;
      const sport = await prisma.sport.create({
        data: { ...data, slug: slugify(data.name), victoryMethods: { create: victoryMethods.map(({ id: _i, ...m }) => m) }, beltLevels: { create: beltLevels.map(({ id: _i, ...b }) => b) } },
        include,
      });
      return reply.status(201).send(sport);
    },
  );

  app.put(
    '/:id',
    { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Deportes'], params: idParam, body: z.object({ name: z.string().trim().min(2).max(60), defaultDurationSec: z.number().int().min(30).max(3600), description: optionalText(1000), victoryMethods: z.array(methodIn).min(1), beltLevels: z.array(beltIn) }), response: { 200: sportOut } } },
    async (req) => {
      const { victoryMethods, beltLevels, ...data } = req.body;
      const id = req.params.id;
      await prisma.$transaction(async (tx) => {
        await tx.sport.update({ where: { id }, data: { ...data, slug: slugify(data.name) } });
        // métodos: upsert por id, eliminar los que no vienen
        const keepM = victoryMethods.filter((m) => m.id).map((m) => m.id!);
        await tx.victoryMethod.deleteMany({ where: { sportId: id, id: { notIn: keepM } } });
        for (const m of victoryMethods) {
          if (m.id) await tx.victoryMethod.update({ where: { id: m.id }, data: { code: m.code, name: m.name, order: m.order, points: m.points } });
          else await tx.victoryMethod.create({ data: { sportId: id, code: m.code, name: m.name, order: m.order, points: m.points } });
        }
        const keepB = beltLevels.filter((b) => b.id).map((b) => b.id!);
        await tx.beltLevel.deleteMany({ where: { sportId: id, id: { notIn: keepB } } });
        for (const b of beltLevels) {
          if (b.id) await tx.beltLevel.update({ where: { id: b.id }, data: { name: b.name, color: b.color, secondary: b.secondary ?? null, order: b.order } });
          else await tx.beltLevel.create({ data: { sportId: id, name: b.name, color: b.color, secondary: b.secondary ?? null, order: b.order } });
        }
      });
      return prisma.sport.findUniqueOrThrow({ where: { id }, include });
    },
  );

  app.delete('/:id', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Deportes'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.sport.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
};
