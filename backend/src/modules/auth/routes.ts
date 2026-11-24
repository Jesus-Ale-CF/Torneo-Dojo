import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { unauthorized } from '../../lib/errors.js';
import { roleEnum } from '../../lib/schemas.js';

const userDto = z.object({ id: z.string(), email: z.string(), name: z.string(), role: roleEnum, mats: z.array(z.object({ id: z.string(), name: z.string(), tournamentId: z.string(), tournamentName: z.string() })) });

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/login',
    {
      // Límite de intentos por IP + correo: frena la fuerza bruta sin bloquear a toda una sede detrás de la misma IP
      config: {
        rateLimit: {
          hook: 'preValidation', // el cuerpo ya está leído (el correo forma parte de la clave)
          max: 10,
          timeWindow: '15 minutes',
          keyGenerator: (req) => `${req.ip}|${String((req.body as { email?: unknown } | undefined)?.email ?? '').toLowerCase()}`,
        },
      },
      schema: {
        tags: ['Auth'],
        security: [],
        body: z.object({ email: z.string().email(), password: z.string().min(1) }),
        response: { 200: z.object({ token: z.string(), user: userDto }) },
      },
    },
    async (req) => {
      const user = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() }, include: { mats: { include: { mat: { include: { tournament: { select: { name: true } } } } } } } });
      if (!user || !user.active || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
        throw unauthorized('Correo o contraseña incorrectos');
      }
      const token = app.jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role });
      return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, mats: user.mats.map((m) => ({ id: m.mat.id, name: m.mat.name, tournamentId: m.mat.tournamentId, tournamentName: m.mat.tournament.name })) },
      };
    },
  );

  app.get('/me', { preHandler: [app.authenticate], schema: { tags: ['Auth'], response: { 200: userDto } } }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id }, include: { mats: { include: { mat: { include: { tournament: { select: { name: true } } } } } } } });
    return { id: user.id, email: user.email, name: user.name, role: user.role, mats: user.mats.map((m) => ({ id: m.mat.id, name: m.mat.name, tournamentId: m.mat.tournamentId, tournamentName: m.mat.tournament.name })) };
  });
};
