import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

/**
 * Mensajes de validación en español. Se registran de forma global al arrancar la app,
 * así que aplican a todos los esquemas (cuerpos, parámetros y query).
 */
export const esErrorMap: ZodErrorMap = (issue, ctx) => {
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
      if (issue.type === 'array') return { message: `Como máximo ${issue.maximum} elemento(s)` };
      return { message: 'Valor demasiado grande' };
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'Correo electrónico no válido' };
      if (issue.validation === 'uuid') return { message: 'Selecciona una opción válida' };
      if (issue.validation === 'regex') return { message: 'Formato no válido' };
      return { message: 'Texto no válido' };
    case ZodIssueCode.invalid_enum_value:
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union:
      return { message: 'Selecciona una opción válida' };
    case ZodIssueCode.not_finite:
      return { message: 'Debe ser un número' };
    case ZodIssueCode.invalid_date:
      return { message: 'Fecha no válida' };
    default:
      return { message: ctx.defaultError };
  }
};
z.setErrorMap(esErrorMap);

/** Texto opcional: recorta espacios y convierte "" en null (no guardar cadenas vacías). */
export const optionalText = (max = 500) =>
  z.string().trim().max(max).nullish().transform((v) => (v === '' ? null : v));

/** Ruta de un issue → clave de campo ("victoryMethods.1.code"). */
export const issuePath = (path: (string | number)[]) => path.join('.');
