import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParam, okResponse } from '../../lib/schemas.js';
import { bracketOut } from './dto.js';
import { deleteBracket, generateForCategory, getBracket } from './service.js';

export const bracketRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/categories/:id/bracket', { preHandler: [app.authenticate], schema: { tags: ['Llaves'], params: idParam, response: { 200: bracketOut } } }, async (req) => getBracket(req.params.id));

  app.post(
    '/categories/:id/bracket/generate',
    { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Llaves'], params: idParam, body: z.object({ manualSeeding: z.boolean().default(false), avoidSameAcademy: z.boolean().optional() }), response: { 200: bracketOut } } },
    async (req) => generateForCategory(req.params.id, req.body),
  );

  app.delete('/categories/:id/bracket', { preHandler: [app.requireRole('ADMIN')], schema: { tags: ['Llaves'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await deleteBracket(req.params.id);
    return { ok: true };
  });
};
