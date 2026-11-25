import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import './lib/zod-es.js'; // mensajes de validación en español (registro global)
import { issuePath } from './lib/zod-es.js';
import { Prisma } from '@prisma/client';
import { env } from './lib/env.js';
import { AppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { sportRoutes } from './modules/sports/routes.js';
import { tournamentRoutes } from './modules/tournaments/routes.js';
import { categoryRoutes } from './modules/categories/routes.js';
import { academyRoutes } from './modules/academies/routes.js';
import { athleteRoutes } from './modules/athletes/routes.js';
import { registrationRoutes } from './modules/registrations/routes.js';
import { bracketRoutes } from './modules/brackets/routes.js';
import { matRoutes } from './modules/mats/routes.js';
import { matchRoutes } from './modules/matches/routes.js';
import { medalRoutes } from './modules/medals/routes.js';
import { publicRoutes } from './modules/public/routes.js';
import { exportRoutes } from './modules/exports/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test' && { level: env.NODE_ENV === 'production' ? 'info' : 'warn' },
    // En producción no se registra cada petición (health checks y polling llenarían el log)
    logController: new LogController({ disableRequestLogging: env.NODE_ENV === 'production' }),
    trustProxy: env.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();
  for (const w of env.warnings) app.log.warn(w);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Content-Disposition expuesta: el frontend en otro dominio lee el nombre de los PDF/Excel descargados
  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true, exposedHeaders: ['Content-Disposition'] });
  // Solo se limitan las rutas que lo piden (login); el resto, incluido el polling público, no
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) =>
      new AppError(429, `Demasiados intentos. Espera ${Math.ceil(ctx.ttl / 60000)} min y vuelve a intentarlo.`, 'RATE_LIMIT'),
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Torneo Dojo API',
        description: 'API REST para la gestión de torneos de deportes de combate.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth' }, { name: 'Usuarios' }, { name: 'Deportes' }, { name: 'Torneos' }, { name: 'Categorías' },
        { name: 'Academias' }, { name: 'Atletas' }, { name: 'Inscripciones' }, { name: 'Llaves' }, { name: 'Tatamis' },
        { name: 'Combates' }, { name: 'Medallero' }, { name: 'Público' }, { name: 'Exportación' },
      ],
    },
    transform: jsonSchemaTransform,
  });
  if (env.DOCS_ENABLED) await app.register(swaggerUi, { routePrefix: '/docs' });
  // Cabeceras de seguridad. CSP compatible con Swagger UI; CORP cross-origin porque el frontend vive en otro dominio
  await app.register(helmet, (instance) => ({
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    contentSecurityPolicy: {
      // useDefaults (por defecto true): estas directivas se combinan con las de helmet
      directives: {
        'form-action': ["'self'"],
        'img-src': ["'self'", 'data:', 'validator.swagger.io'],
        'script-src': ["'self'", ...(env.DOCS_ENABLED ? instance.swaggerCSP.script : [])],
        // Swagger UI aplica estilos inline desde JS: 'unsafe-inline' solo en estilos y solo con /docs activo
        'style-src': ["'self'", 'https:', ...(env.DOCS_ENABLED ? [...instance.swaggerCSP.style, "'unsafe-inline'"] : [])],
        // Sin upgrade-insecure-requests: Docker sirve /docs por http y los recursos dejarían de cargar
        'upgrade-insecure-requests': null,
      },
    },
  }));
  await app.register(authPlugin);

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ statusCode: err.statusCode, code: err.code, message: err.message, details: err.details });
    }
    // Validación: se devuelve un mensaje por campo ({ fields: { ruta: mensaje } }) para mostrarlo bajo cada input
    if (err instanceof ZodError || (err as { validation?: unknown }).validation) {
      const fields: Record<string, string> = {};
      if (err instanceof ZodError) {
        for (const i of err.issues) fields[issuePath(i.path)] ??= i.message;
      } else {
        const list = (err as { validation: { instancePath?: string; message?: string; params?: { issue?: { path?: (string | number)[]; message?: string } } }[] }).validation;
        for (const v of list) {
          const path = v.params?.issue?.path ? issuePath(v.params.issue.path) : (v.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.');
          fields[path || '_'] ??= v.params?.issue?.message ?? v.message ?? 'Valor no válido';
        }
      }
      return reply.status(400).send({ statusCode: 400, code: 'VALIDATION', message: 'Revisa los campos marcados', details: { fields } });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        // Restricción única → error en el campo que la incumple (ej. nombre de deporte repetido)
        const target = err.meta?.target;
        const cols = Array.isArray(target) ? (target as string[]) : typeof target === 'string' ? [target.replace(/^[A-Za-z]+_|_key$/g, '')] : [];
        const fields = Object.fromEntries(cols.map((c) => [c, 'Ya existe un registro con este valor']));
        return reply.status(409).send({ statusCode: 409, code: 'DUPLICATE', message: cols.length ? 'Ya existe un registro con este valor' : 'Ya existe un registro con esos datos', details: { fields } });
      }
      if (err.code === 'P2025') {
        return reply.status(404).send({ statusCode: 404, code: 'NOT_FOUND', message: 'Recurso no encontrado' });
      }
      if (err.code === 'P2003') {
        return reply.status(409).send({ statusCode: 409, code: 'IN_USE', message: 'No se puede eliminar: el registro está en uso' });
      }
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.status(status).send({
      statusCode: status,
      code: status >= 500 ? 'INTERNAL' : 'ERROR',
      message: status >= 500 ? 'Error interno del servidor' : (err as Error).message,
    });
  });

  // Health check ligero: NO consulta la base de datos (Render y el monitor externo lo llaman a menudo)
  // /api/health: mismo check bajo /api, para que el frontend lo alcance también tras el proxy de nginx y Vite
  const health = async () => ({ ok: true, ts: new Date().toISOString() });
  app.get('/health', { schema: { tags: ['Público'], security: [] }, logLevel: 'warn' }, health);
  app.get('/api/health', { schema: { tags: ['Público'], security: [] }, logLevel: 'warn' }, health);

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(sportRoutes, { prefix: '/api/sports' });
  await app.register(tournamentRoutes, { prefix: '/api/tournaments' });
  await app.register(categoryRoutes, { prefix: '/api' });
  await app.register(academyRoutes, { prefix: '/api/academies' });
  await app.register(athleteRoutes, { prefix: '/api/athletes' });
  await app.register(registrationRoutes, { prefix: '/api' });
  await app.register(bracketRoutes, { prefix: '/api' });
  await app.register(matRoutes, { prefix: '/api' });
  await app.register(matchRoutes, { prefix: '/api' });
  await app.register(medalRoutes, { prefix: '/api' });
  await app.register(publicRoutes, { prefix: '/api/public' });
  await app.register(exportRoutes, { prefix: '/api/export' });

  return app;
}
