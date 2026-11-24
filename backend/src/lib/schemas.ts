import { z } from 'zod';

export const idParam = z.object({ id: z.string().uuid() });
export const genderEnum = z.enum(['M', 'F', 'X']);
export const roleEnum = z.enum(['ADMIN', 'TABLE']);
export const tournamentStatusEnum = z.enum(['DRAFT', 'REGISTRATION', 'WEIGH_IN', 'IN_PROGRESS', 'FINISHED']);
export const bracketFormatEnum = z.enum(['SINGLE_ELIMINATION', 'SINGLE_ELIMINATION_BRONZE', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN']);
export const weighInStatusEnum = z.enum(['PENDING', 'OK', 'OVERWEIGHT', 'UNDERWEIGHT', 'DISQUALIFIED']);
export const matchStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'FINISHED', 'BYE']);
export const okResponse = z.object({ ok: z.boolean() });
export const errorResponse = z.object({ statusCode: z.number(), code: z.string(), message: z.string(), details: z.any().optional() });
export const dateString = z.string({ required_error: 'Este campo es obligatorio' }).min(1, 'Este campo es obligatorio').refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha no válida');
