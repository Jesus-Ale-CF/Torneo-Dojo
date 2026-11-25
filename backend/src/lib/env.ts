import { z } from 'zod';

const DEV_JWT_SECRET = 'zenkai-dev-secret-cambiar';
/** Valor de ejemplo de `.env.example` y docker-compose: se acepta (Docker local) pero se avisa. */
const PLACEHOLDER_JWT_SECRET = 'cambia-este-secreto-en-produccion';

const bool = (def: boolean) =>
  z.enum(['true', 'false', '1', '0']).optional().transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8).optional(),
  JWT_EXPIRES_IN: z.string().default('12h'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Orígenes permitidos separados por comas (URL exacta del frontend). `*` solo fuera de producción. */
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Swagger UI en /docs (true por defecto) */
  DOCS_ENABLED: bool(true),
  /** Detrás de un proxy (Render): usar X-Forwarded-For para la IP del cliente (límite de intentos de login) */
  TRUST_PROXY: bool(false),
});

export type Env = Omit<z.infer<typeof schema>, 'JWT_SECRET' | 'CORS_ORIGIN'> & {
  JWT_SECRET: string;
  /** `true` = cualquier origen (solo desarrollo); si no, lista exacta de orígenes */
  CORS_ORIGINS: true | string[];
  warnings: string[];
};

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const raw = schema.parse(source);
  const prod = raw.NODE_ENV === 'production';
  const warnings: string[] = [];

  if (prod && (!raw.JWT_SECRET || raw.JWT_SECRET === DEV_JWT_SECRET)) {
    throw new Error('JWT_SECRET es obligatorio en producción (usa un valor aleatorio largo, p. ej. `openssl rand -base64 32`).');
  }
  if (prod && raw.JWT_SECRET!.length < 16) throw new Error('JWT_SECRET debe tener al menos 16 caracteres en producción.');
  if (raw.JWT_SECRET === PLACEHOLDER_JWT_SECRET) warnings.push('JWT_SECRET usa el valor de ejemplo: cámbialo si el servidor es accesible desde internet.');

  const origin = (raw.CORS_ORIGIN ?? (prod ? '' : '*')).trim();
  let CORS_ORIGINS: true | string[];
  if (origin === '*') {
    if (prod) throw new Error('CORS_ORIGIN no puede ser `*` en producción: indica la URL exacta del frontend (ej. https://torneo-dojo.onrender.com).');
    CORS_ORIGINS = true;
  } else {
    CORS_ORIGINS = origin.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
    if (prod && !CORS_ORIGINS.length) throw new Error('CORS_ORIGIN es obligatorio en producción: indica la URL exacta del frontend.');
    for (const o of CORS_ORIGINS) {
      if (!/^https?:\/\/[^/]+$/.test(o)) throw new Error(`CORS_ORIGIN no válido: "${o}" (formato esperado: https://dominio, sin ruta).`);
    }
  }

  return { ...raw, JWT_SECRET: raw.JWT_SECRET ?? DEV_JWT_SECRET, CORS_ORIGINS, warnings };
}

export const env = parseEnv(process.env);
