import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { idParam, okResponse } from '../../lib/schemas.js';
import { optionalText } from '../../lib/zod-es.js';

const out = z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable(), city: z.string().nullable(), color: z.string().nullable(), _count: z.object({ athletes: z.number() }) });
const body = z.object({ name: z.string().trim().min(2).max(100), abbreviation: optionalText(8), city: optionalText(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() });
const include = { _count: { select: { athletes: true } } };

export const academyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: [app.authenticate], schema: { tags: ['Academias'], response: { 200: z.array(out) } } }, async () => prisma.academy.findMany({ include, orderBy: { name: 'asc' } }));
  app.post('/', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Academias'], body, response: { 201: out } } }, async (req, reply) =>
    reply.status(201).send(await prisma.academy.create({ data: req.body, include })));
  app.patch('/:id', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Academias'], params: idParam, body: body.partial(), response: { 200: out } } }, async (req) =>
    prisma.academy.update({ where: { id: req.params.id }, data: req.body, include }));
  app.delete('/:id', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Academias'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.academy.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
};
