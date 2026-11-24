import { z, ZodIssueCode, type ZodError, type ZodErrorMap } from 'zod';

/** Mismos mensajes que el backend (backend/src/lib/zod-es.ts). */
const esErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Este campo es obligatorio' };
      if (issue.expected === 'number') return { message: 'Debe ser un número' };
      return { message: 'Valor no válido' };
    case ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: Number(issue.minimum) <= 1 || (typeof ctx.data === 'string' && ctx.data.trim() === '') ? 'Este campo es obligatorio' : `Debe tener al menos ${issue.minimum} caracteres` };
      if (issue.type === 'number') return { message: `Debe ser mayor o igual que ${issue.minimum}` };
      if (issue.type === 'array') return { message: `Añade al menos ${issue.minimum} elemento(s)` };
      return { message: 'Valor demasiado pequeño' };
    case ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Debe tener como máximo ${issue.maximum} caracteres` };
      if (issue.type === 'number') return { message: `Debe ser menor o igual que ${issue.maximum}` };
      return { message: 'Valor demasiado grande' };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Correo electrónico no válido' };
      if (issue.validation === 'uuid') return { message: 'Selecciona una opción válida' };
      return { message: 'Formato no válido' };
    case ZodIssueCode.invalid_enum_value:
      return { message: 'Selecciona una opción válida' };
    default:
      return { message: ctx.defaultError };
  }
};
z.setErrorMap(esErrorMap);

export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join('.') || '_'] ??= i.message;
  return out;
}

const txt = (min: number, max: number) => z.string().trim().min(min).max(max);
const optTxt = (max: number) => z.string().trim().max(max).optional().nullable();
const date = z.string().min(1, 'Este campo es obligatorio').refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha no válida');
const int = (min: number, max = 100000) => z.number({ invalid_type_error: 'Debe ser un número' }).int('Debe ser un número entero').min(min).max(max);

export const tournamentSchema = z.object({
  name: txt(3, 120), venue: txt(2, 120), city: optTxt(80), startDate: date, endDate: date,
  sportId: z.string().min(1, 'Selecciona un deporte'), status: z.string(), pointsGold: int(0), pointsSilver: int(0), pointsBronze: int(0), description: optTxt(2000),
}).refine((t) => !t.startDate || !t.endDate || t.endDate >= t.startDate, { path: ['endDate'], message: 'La fecha de fin no puede ser anterior a la de inicio' });

export const sportSchema = z.object({
  name: txt(2, 60), defaultDurationSec: int(30, 3600), description: optTxt(1000),
  victoryMethods: z.array(z.object({ code: txt(1, 20).regex(/^[A-Za-z0-9_]+$/, 'Solo letras, números y guion bajo'), name: txt(1, 60), points: int(0, 100) })).min(1, 'Añade al menos un método de victoria'),
  beltLevels: z.array(z.object({ name: txt(1, 40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido') })),
});

export const academySchema = z.object({ name: txt(2, 100), abbreviation: optTxt(8), city: optTxt(80) });

export const athleteSchema = z.object({
  firstName: txt(1, 60), lastName: txt(1, 80), document: txt(3, 30), birthDate: date.refine((s) => new Date(s) < new Date(), 'La fecha debe ser anterior a hoy'),
  gender: z.enum(['M', 'F', 'X']), email: z.union([z.literal(''), z.string().trim().email()]), phone: optTxt(30),
});

export const userSchema = (isNew: boolean) => z.object({
  name: txt(2, 80), email: z.string().trim().email(),
  password: isNew ? z.string().min(6) : z.union([z.literal(''), z.string().min(6)]),
});

export const divisionSchema = z.object({ name: txt(1, 40), minKg: z.string(), maxKg: z.string() })
  .refine((d) => !d.minKg || !d.maxKg || Number(d.maxKg) > Number(d.minKg), { path: ['maxKg'], message: 'Debe ser mayor que el mínimo' });
export const ageGroupSchema = z.object({ name: txt(1, 40), minAge: z.string().min(1), maxAge: z.string().min(1) })
  .refine((a) => Number(a.maxAge) >= Number(a.minAge), { path: ['maxAge'], message: 'Debe ser mayor o igual que la edad mínima' });
