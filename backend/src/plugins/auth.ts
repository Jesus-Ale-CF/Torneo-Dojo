import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../lib/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export interface JwtUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TABLE';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: JwtUser['role'][]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });

  /** Verifica el JWT y comprueba en la BD que el usuario sigue activo; el rol vigente es el de la BD. */
  const verify = async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw unauthorized();
    }
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, role: true, active: true } });
    if (!u || !u.active) throw unauthorized('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    req.user = { id: u.id, email: u.email, name: u.name, role: u.role };
  };

  app.decorate('authenticate', verify);

  app.decorate('optionalAuth', async (req: FastifyRequest) => {
    if (!req.headers.authorization) return;
    try {
      await verify(req);
    } catch {
      /* token inválido: se trata como público */
      (req as { user?: unknown }).user = undefined;
    }
  });

  app.decorate('requireRole', (...roles: JwtUser['role'][]) => async (req: FastifyRequest) => {
    await verify(req);
    if (!roles.includes(req.user.role)) throw forbidden();
  });
});
