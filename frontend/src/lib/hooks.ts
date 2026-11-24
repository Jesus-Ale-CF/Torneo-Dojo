import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { ZodType } from 'zod';
import { useToast } from './toast';
import { ApiError } from './api';
import { zodFieldErrors } from './validation';

export type FieldErrorMap = Record<string, string>;

/** Errores por campo de un ApiError de validación ({ details: { fields } }). */
export function fieldErrorsOf(e: unknown): FieldErrorMap | undefined {
  if (!(e instanceof ApiError)) return undefined;
  const f = (e.details as { fields?: FieldErrorMap } | undefined)?.fields;
  return f && Object.keys(f).length ? f : undefined;
}

/**
 * Mutación con toast, invalidación de claves y validación.
 * - `schema`: valida en el cliente antes de enviar (mismos mensajes que el servidor).
 * - `fieldErrors`: errores por campo (cliente o servidor), listos para `<FormErrors errors={m.fieldErrors}>`.
 * - Si el error es de campos, el toast dice "Revisa los campos marcados" en vez de un mensaje genérico.
 */
export function useMut<TVars, TData = unknown>(
  fn: (v: TVars) => Promise<TData>,
  opts: { invalidate?: QueryKey[]; success?: string; onSuccess?: (d: TData, v: TVars) => void; schema?: ZodType<unknown> | ((v: TVars) => ZodType<unknown>) } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation<TData, Error, TVars>({
    mutationFn: async (v) => {
      if (opts.schema) {
        const schema = typeof opts.schema === 'function' ? opts.schema(v) : opts.schema;
        const r = schema.safeParse(v);
        if (!r.success) throw new ApiError(400, 'Revisa los campos marcados', 'VALIDATION', { fields: zodFieldErrors(r.error) });
      }
      return fn(v);
    },
    onSuccess: (d, v) => {
      for (const k of opts.invalidate ?? []) void qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(d, v);
    },
    onError: (e) => toast.error(fieldErrorsOf(e) ? 'Revisa los campos marcados' : e.message),
  });
  return { ...m, fieldErrors: fieldErrorsOf(m.error) };
}
