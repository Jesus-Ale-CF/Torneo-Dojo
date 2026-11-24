import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { idParam, okResponse, roleEnum } from '../../lib/schemas.js';
import { badRequest } from '../../lib/errors.js';

const userOut = z.object({
  id: z.string(), email: z.string(), name: z.string(), role: roleEnum, active: z.boolean(), createdAt: z.date(),
  mats: z.array(z.object({ id: z.string(), name: z.string(), tournamentId: z.string(), tournamentName: z.string() })),
});
const mapUser = (u: { id: string; email: string; name: string; role: 'ADMIN' | 'TABLE'; active: boolean; createdAt: Date; mats: { mat: { id: string; name: string; tournamentId: string; tournament: { name: string } } }[] }) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt,
  mats: u.mats.map((m) => ({ id: m.mat.id, name: m.mat.name, tournamentId: m.mat.tournamentId, tournamentName: m.mat.tournament.name })),
});
const include = { mats: { include: { mat: { include: { tournament: true } } } } } as const;

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('ADMIN'));

  app.get('/', { schema: { tags: ['Usuarios'], response: { 200: z.array(userOut) } } }, async () => {
    const users = await prisma.user.findMany({ include, orderBy: { createdAt: 'asc' } });
    return users.map(mapUser);
  });

  app.post(
    '/',
    { schema: { tags: ['Usuarios'], body: z.object({ email: z.string().trim().email(), name: z.string().trim().min(2).max(80), password: z.string().min(6).max(100), role: roleEnum, matIds: z.array(z.string().uuid()).optional() }), response: { 201: userOut } } },
    async (req, reply) => {
      const { matIds = [], password, ...data } = req.body;
      const user = await prisma.user.create({
        data: { ...data, email: data.email.toLowerCase(), passwordHash: await bcrypt.hash(password, 10), mats: { create: matIds.map((matId) => ({ matId })) } },
        include,
      });
      return reply.status(201).send(mapUser(user));
    },
  );

  app.patch(
    '/:id',
    { schema: { tags: ['Usuarios'], params: idParam, body: z.object({ email: z.string().trim().email().optional(), name: z.string().trim().min(2).max(80).optional(), password: z.string().min(6).max(100).optional(), role: roleEnum.optional(), active: z.boolean().optional(), matIds: z.array(z.string().uuid()).optional() }), response: { 200: userOut } } },
    async (req) => {
      const { matIds, password, ...data } = req.body;
      if (req.params.id === req.user.id && (data.role === 'TABLE' || data.active === false)) throw badRequest('No puedes quitarte tu propio rol de administrador');
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...data,
          ...(data.email ? { email: data.email.toLowerCase() } : {}),
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
          ...(matIds ? { mats: { deleteMany: {}, create: matIds.map((matId) => ({ matId })) } } : {}),
        },
        include,
      });
      return mapUser(user);
    },
  );

  app.delete('/:id', { schema: { tags: ['Usuarios'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    if (req.params.id === req.user.id) throw badRequest('No puedes eliminar tu propio usuario');
    await prisma.user.delete({ where: { id: req.params.id } });
    return { ok: true };
  });
};
