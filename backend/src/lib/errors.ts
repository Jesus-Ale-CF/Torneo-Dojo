export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'APP_ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}
export const notFound = (what = 'Recurso') => new AppError(404, `${what} no encontrado`, 'NOT_FOUND');
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, 'BAD_REQUEST', details);
export const forbidden = (msg = 'No tienes permiso para realizar esta acción') => new AppError(403, msg, 'FORBIDDEN');
export const unauthorized = (msg = 'Debes iniciar sesión') => new AppError(401, msg, 'UNAUTHORIZED');
export const conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');

/** Error de validación con mensajes por campo: { fields: { "venue": "Debe tener al menos 2 caracteres" } } */
export const fieldErrors = (fields: Record<string, string>) =>
  new AppError(400, 'Revisa los campos marcados', 'VALIDATION', { fields });
