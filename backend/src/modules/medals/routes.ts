import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { idParam } from '../../lib/schemas.js';
import { tournamentMedals } from './service.js';
import { assertPublicTournament } from '../../lib/visibility.js';

const entry = z.object({
  registrationId: z.string(),
  athlete: z.object({ id: z.string(), firstName: z.string(), lastName: z.string(), academy: z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable() }).nullable(), beltLevel: z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable() }).nullable() }),
}).nullable();
export const medalsOut = z.object({
  tournament: z.object({ id: z.string(), name: z.string(), pointsGold: z.number(), pointsSilver: z.number(), pointsBronze: z.number() }),
  byCategory: z.array(z.object({ category: z.object({ id: z.string(), name: z.string(), status: z.string(), format: z.string() }), complete: z.boolean(), gold: entry, silver: entry, bronze: z.array(entry.unwrap()) })),
  academies: z.array(z.object({ academyId: z.string(), academyName: z.string(), gold: z.number(), silver: z.number(), bronze: z.number(), points: z.number(), rank: z.number() })),
});

export const medalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/tournaments/:id/medals', { preHandler: [app.optionalAuth], schema: { tags: ['Medallero'], security: [], params: idParam, response: { 200: medalsOut } } }, async (req) => {
    await assertPublicTournament(req.params.id, req.user ?? null);
    return tournamentMedals(req.params.id);
  });
};
