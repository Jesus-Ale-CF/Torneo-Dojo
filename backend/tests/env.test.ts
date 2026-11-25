import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://x'; // env.ts valida process.env al importarse
const { parseEnv } = await import('../src/lib/env.js');
import { seedCredentials } from '../prisma/seed-credentials.js';

const base = { DATABASE_URL: 'postgresql://x' };
const prod = { ...base, NODE_ENV: 'production', JWT_SECRET: 'un-secreto-largo-de-prueba', CORS_ORIGIN: 'https://zenkai.onrender.com' } as const;

describe('parseEnv', () => {
  it('desarrollo: valores por defecto (CORS abierto, secreto de desarrollo, docs activas)', () => {
    const e = parseEnv(base);
    expect(e.CORS_ORIGINS).toBe(true);
    expect(e.JWT_SECRET.length).toBeGreaterThan(8);
    expect(e.DOCS_ENABLED).toBe(true);
    expect(e.TRUST_PROXY).toBe(false);
  });
  it('producción: JWT_SECRET obligatorio y sin el valor de desarrollo', () => {
    expect(() => parseEnv({ ...prod, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...prod, JWT_SECRET: 'zenkai-dev-secret-cambiar' })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...prod, JWT_SECRET: 'corto123' })).toThrow(/16/);
  });
  it('producción: CORS_ORIGIN obligatorio, exacto y nunca "*"', () => {
    expect(() => parseEnv({ ...prod, CORS_ORIGIN: undefined })).toThrow(/CORS_ORIGIN/);
    expect(() => parseEnv({ ...prod, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
    expect(() => parseEnv({ ...prod, CORS_ORIGIN: 'zenkai.onrender.com' })).toThrow(/no válido/);
    expect(parseEnv({ ...prod, CORS_ORIGIN: 'https://a.com/, https://b.com' }).CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });
  it('DOCS_ENABLED y TRUST_PROXY se leen como booleanos', () => {
    const e = parseEnv({ ...prod, DOCS_ENABLED: 'false', TRUST_PROXY: 'true' });
    expect(e.DOCS_ENABLED).toBe(false);
    expect(e.TRUST_PROXY).toBe(true);
  });
  it('avisa si se usa el JWT_SECRET de ejemplo', () => {
    expect(parseEnv({ ...prod, JWT_SECRET: 'cambia-este-secreto-en-produccion' }).warnings).toHaveLength(1);
  });
});

describe('seedCredentials', () => {
  it('desarrollo: contraseñas conocidas', () => {
    expect(seedCredentials({})).toMatchObject({ adminEmail: 'admin@torneo.dojo', adminPassword: 'admin123', tablePassword: 'mesa123', fromEnv: false });
  });
  it('producción: exige SEED_ADMIN_PASSWORD y SEED_TABLE_PASSWORD', () => {
    expect(() => seedCredentials({ NODE_ENV: 'production' })).toThrow(/SEED_ADMIN_PASSWORD, SEED_TABLE_PASSWORD/);
    expect(() => seedCredentials({ NODE_ENV: 'production', SEED_ADMIN_PASSWORD: 'abc', SEED_TABLE_PASSWORD: 'abcdefgh' })).toThrow(/al menos/);
    expect(() => seedCredentials({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'no-es-correo', SEED_ADMIN_PASSWORD: 'abcdefgh', SEED_TABLE_PASSWORD: 'abcdefgh' })).toThrow(/correo/);
    expect(seedCredentials({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: ' Demo@Club.com ', SEED_ADMIN_PASSWORD: 'abcdefgh', SEED_TABLE_PASSWORD: '12345678' }))
      .toEqual({ adminEmail: 'demo@club.com', adminPassword: 'abcdefgh', tablePassword: '12345678', fromEnv: true });
  });
  it('restablecer la demo (SEED_REQUIRE_ENV) nunca usa las contraseñas de desarrollo', () => {
    expect(() => seedCredentials({ SEED_REQUIRE_ENV: 'true' })).toThrow(/Faltan/);
  });
});
