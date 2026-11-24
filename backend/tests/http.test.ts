/* Comportamiento HTTP de producción sin base de datos: /health, cabeceras, CORS, límite de login y /docs. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const FRONT = 'https://zenkai-web.example.com';

async function build(extra: Record<string, string> = {}) {
  vi.resetModules();
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://nadie:nada@127.0.0.1:1/nada',
    NODE_ENV: 'test',
    JWT_SECRET: 'secreto-de-pruebas-1234',
    CORS_ORIGIN: FRONT,
    DOCS_ENABLED: 'true',
    ...extra,
  });
  const { buildApp } = await import('../src/app.js');
  const app = await buildApp();
  await app.ready();
  return app;
}

describe('API en modo producción', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await build(); });
  afterAll(() => app.close());

  it('GET y HEAD /health responden sin base de datos (la BD de prueba no existe)', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
    expect((await app.inject({ method: 'HEAD', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });

  it('cabeceras de seguridad (helmet)', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBeDefined();
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS: solo el origen exacto del frontend y expone Content-Disposition', async () => {
    const ok = await app.inject({ method: 'OPTIONS', url: '/api/auth/login', headers: { origin: FRONT, 'access-control-request-method': 'POST' } });
    expect(ok.headers['access-control-allow-origin']).toBe(FRONT);
    const get = await app.inject({ method: 'GET', url: '/health', headers: { origin: FRONT } });
    expect(get.headers['access-control-expose-headers']).toContain('Content-Disposition');
    const bad = await app.inject({ method: 'OPTIONS', url: '/api/auth/login', headers: { origin: 'https://malo.example.com', 'access-control-request-method': 'POST' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('login: 10 intentos por IP y correo cada 15 min, luego 429 en español', async () => {
    const attempt = (email: string) => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: '' } });
    for (let i = 0; i < 10; i++) expect((await attempt('a@b.co')).statusCode).toBe(400); // contraseña vacía → validación, sin BD
    const blocked = await attempt('a@b.co');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ code: 'RATE_LIMIT' });
    expect(blocked.json().message).toMatch(/Demasiados intentos/);
    expect((await attempt('otra@b.co')).statusCode).toBe(400); // otro correo, otro contador
  });

  it('Swagger en /docs cuando DOCS_ENABLED=true', async () => {
    expect((await app.inject({ method: 'GET', url: '/docs/json' })).statusCode).toBe(200);
  });
});

describe('DOCS_ENABLED=false', () => {
  it('oculta /docs', async () => {
    const app = await build({ DOCS_ENABLED: 'false' });
    expect((await app.inject({ method: 'GET', url: '/docs' })).statusCode).toBe(404);
    await app.close();
  });
});
