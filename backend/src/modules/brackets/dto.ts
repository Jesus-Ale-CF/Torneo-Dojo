import { z } from 'zod';
import { bracketFormatEnum, genderEnum, matchStatusEnum } from '../../lib/schemas.js';

const athleteMini = z.object({
  id: z.string(), firstName: z.string(), lastName: z.string(),
  academy: z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable() }).nullable(),
  beltLevel: z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable() }).nullable(),
});
export const regMini = z.object({ id: z.string(), seed: z.number().nullable(), weighInStatus: z.string(), athlete: athleteMini }).nullable();
export const matchOut = z.object({
  id: z.string(), categoryId: z.string(), side: z.string(), round: z.number(), position: z.number(), label: z.string().nullable(), order: z.number(),
  redId: z.string().nullable(), blueId: z.string().nullable(), winnerId: z.string().nullable(), victoryMethodId: z.string().nullable(),
  red: regMini, blue: regMini, victoryMethod: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
  status: matchStatusEnum, nextMatchId: z.string().nullable(), nextSlot: z.string().nullable(), loserNextId: z.string().nullable(), loserNextSlot: z.string().nullable(),
  matId: z.string().nullable(), mat: z.object({ id: z.string(), name: z.string() }).nullable(), matOrder: z.number().nullable(), scheduledAt: z.date().nullable(),
  startedAt: z.date().nullable(), finishedAt: z.date().nullable(),
  category: z.object({ id: z.string(), name: z.string(), tournamentId: z.string(), format: bracketFormatEnum, durationSec: z.number().nullable() }),
});
export const podiumOut = z.object({ gold: z.string().nullable(), silver: z.string().nullable(), bronze: z.array(z.string()), complete: z.boolean() });
export const standingOut = z.object({ participantId: z.string(), played: z.number(), wins: z.number(), losses: z.number(), methodPoints: z.number(), rank: z.number() });
export const bracketOut = z.object({
  category: z.object({
    id: z.string(), name: z.string(), gender: genderEnum, format: bracketFormatEnum, status: z.string(), tiebreakRules: z.string(), durationSec: z.number().nullable(),
    weightDivision: z.object({ id: z.string(), name: z.string(), minKg: z.number().nullable(), maxKg: z.number().nullable() }).nullable(),
    ageGroup: z.object({ id: z.string(), name: z.string() }).nullable(),
    beltLevel: z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable() }).nullable(),
    mat: z.object({ id: z.string(), name: z.string() }).nullable(),
    tournament: z.object({ id: z.string(), name: z.string(), sport: z.object({ id: z.string(), name: z.string(), victoryMethods: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), points: z.number() })) }) }),
    registrations: z.array(regMini.unwrap()),
  }),
  matches: z.array(matchOut),
  podium: podiumOut,
  standings: z.array(standingOut).nullable(),
});
