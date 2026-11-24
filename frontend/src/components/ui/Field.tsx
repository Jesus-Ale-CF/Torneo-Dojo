import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/* ------------------------------------------------------------------ errores por campo */
type Errors = Record<string, string>;
interface Ctx { errors: Errors; clear: (name: string) => void }
const FormErrorsCtx = createContext<Ctx>({ errors: {}, clear: () => undefined });

/**
 * Proveedor de errores por campo. Recibe `errors` (normalmente `mutation.fieldErrors` de `useMut`)
 * y los reparte a los campos por su `name` (rutas tipo "victoryMethods.0.code").
 * Al editar un campo su error desaparece; al llegar errores nuevos, el foco va al primer campo inválido.
 */
export function FormErrors({ errors, children }: { errors?: Errors | null; children: ReactNode }) {
  const [state, setState] = useState<Errors>(errors ?? {});
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setState(errors ?? {});
    const first = errors && Object.keys(errors)[0];
    if (first) requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)?.focus());
  }, [errors]);
  const clear = useCallback((name: string) => setState((s) => { if (!(name in s)) return s; const n = { ...s }; delete n[name]; return n; }), []);
  const value = useMemo(() => ({ errors: state, clear }), [state, clear]);
  const general = errors?._;
  return <FormErrorsCtx.Provider value={value}><div ref={box}>{general && <p role="alert" className="mb-3 rounded-lg border border-shu/40 bg-shu/10 px-3 py-2 text-sm text-shu">{general}</p>}{children}</div></FormErrorsCtx.Provider>;
}

/** Error para un campo: explícito > contexto. Devuelve también un handler que limpia el error al editar. */
export function useFieldError(name?: string, explicit?: string) {
  const { errors, clear } = useContext(FormErrorsCtx);
  return { error: explicit ?? (name ? errors[name] : undefined), clear: () => name && clear(name) };
}

/* ------------------------------------------------------------------ campos */
interface Base { label: string; hint?: string; error?: string; className?: string }

export function Field({ label, hint, error, className = '', children, id }: Base & { children: (id: string, describedBy?: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const msgId = `${fid}-msg`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={fid} className="text-sm font-medium">{label}</label>
      {children(fid, error || hint ? msgId : undefined)}
      {error ? <p id={msgId} className="text-xs font-medium text-shu" role="alert">{error}</p> : hint ? <p id={msgId} className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ label, hint, error: explicit, className, onChange, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const { error, clear } = useFieldError(rest.name, explicit);
  return <Field label={label} hint={hint} error={error} className={className}>{(id, d) => <input id={id} className={`input ${error ? 'border-shu' : ''}`} aria-invalid={!!error} aria-describedby={d} onChange={(e) => { clear(); onChange?.(e); }} {...rest} />}</Field>;
}
export function Select({ label, hint, error: explicit, className, children, onChange, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const { error, clear } = useFieldError(rest.name, explicit);
  return <Field label={label} hint={hint} error={error} className={className}>{(id, d) => <select id={id} className={`input ${error ? 'border-shu' : ''}`} aria-invalid={!!error} aria-describedby={d} onChange={(e) => { clear(); onChange?.(e); }} {...rest}>{children}</select>}</Field>;
}
export function Textarea({ label, hint, error: explicit, className, onChange, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { error, clear } = useFieldError(rest.name, explicit);
  return <Field label={label} hint={hint} error={error} className={className}>{(id, d) => <textarea id={id} className={`input min-h-[88px] ${error ? 'border-shu' : ''}`} aria-invalid={!!error} aria-describedby={d} onChange={(e) => { clear(); onChange?.(e); }} {...rest} />}</Field>;
}

/** Input compacto para filas de tablas/listas (sin label visible: usa aria-label). Muestra su error debajo. */
export function InlineInput({ className = '', onChange, ...rest }: InputHTMLAttributes<HTMLInputElement> & { 'aria-label': string }) {
  const { error, clear } = useFieldError(rest.name);
  const id = useId();
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <input className={`input ${error ? 'border-shu' : ''}`} aria-invalid={!!error} aria-describedby={error ? id : undefined} onChange={(e) => { clear(); onChange?.(e); }} {...rest} />
      {error && <p id={id} className="text-xs font-medium text-shu" role="alert">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, hint, className = '', ...rest }: { label: string; hint?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-touch cursor-pointer items-start gap-3 ${className}`}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 rounded border-line accent-[rgb(var(--c-shu))]" {...rest} />
      <span className="text-sm"><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}
