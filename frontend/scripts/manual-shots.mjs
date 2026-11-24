/**
 * Capturas para el manual de usuario (docs/manual). Requiere la app levantada con los datos del seed.
 *   node scripts/manual-shots.mjs            → http://localhost:5173
 *   BASE=http://localhost:8080 node scripts/manual-shots.mjs
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/manual/img');
mkdirSync(OUT, { recursive: true });
const DESK = { viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1.5, locale: 'es-ES' };
const TABLET = { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1.5, locale: 'es-ES' };
const MOBILE = { ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'es-ES' };

const browser = await chromium.launch();
const shot = async (page, name, opts = {}) => { await page.waitForTimeout(opts.wait ?? 900); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full ?? false, animations: 'disabled' }); console.log('✓', name); };
const login = async (ctx, who) => { const r = await ctx.request.post(`${BASE}/api/auth/login`, { data: who }); const t = (await r.json()).token; await ctx.addInitScript((t) => localStorage.setItem('zenkai-token', t), t); return t; };
const ADMIN = { email: 'admin@zenkai.dojo', password: 'admin123' }, MESA = { email: 'mesa@zenkai.dojo', password: 'mesa123' };

// Datos del seed
const api = await browser.newContext({ baseURL: BASE });
const tours = await (await api.request.get('/api/public/tournaments')).json();
const T = tours.find((t) => t.status === 'IN_PROGRESS') ?? tours[0];
const cats = await (await api.request.get(`/api/public/tournaments/${T.id}/categories`)).json();
const catFinished = cats.find((c) => c.status === 'FINISHED' && c.format !== 'ROUND_ROBIN') ?? cats[0];
const catLive = cats.find((c) => c.status === 'IN_PROGRESS' && c.format !== 'ROUND_ROBIN') ?? catFinished;
const catRR = cats.find((c) => c.format === 'ROUND_ROBIN');
await api.close();

/* ---------- Público (escritorio) ---------- */
{
  const ctx = await browser.newContext({ ...DESK, baseURL: BASE }); const p = await ctx.newPage();
  await p.goto('/'); await shot(p, 'pub-inicio');
  await p.goto('/torneos'); await shot(p, 'pub-torneos');
  await p.goto(`/t/${T.id}`); await shot(p, 'pub-torneo-categorias');
  await p.goto(`/t/${T.id}?tab=tatamis`); await shot(p, 'pub-torneo-tatamis');
  await p.goto(`/t/${T.id}?tab=medallero`); await shot(p, 'pub-torneo-medallero', { full: true });
  await p.goto(`/t/${T.id}/c/${catFinished.id}`); await shot(p, 'pub-categoria', { full: true, wait: 1500 });
  await p.getByRole('button', { name: 'Lista' }).click(); await shot(p, 'pub-categoria-lista', { full: true });
  if (catRR) { await p.goto(`/t/${T.id}/c/${catRR.id}`); await shot(p, 'pub-categoria-rr', { full: true }); }
  await p.goto(`/t/${T.id}/tv`); await shot(p, 'pub-tv', { wait: 1500 });
  await p.goto('/login'); await shot(p, 'login');
  // Tema oscuro
  await p.goto('/'); await p.evaluate(() => localStorage.setItem('zenkai-theme', 'dark')); await p.reload(); await shot(p, 'pub-inicio-oscuro');
  await ctx.close();
}
/* ---------- Público (móvil) ---------- */
{
  const ctx = await browser.newContext({ ...MOBILE, baseURL: BASE }); const p = await ctx.newPage();
  await p.goto('/'); await shot(p, 'mov-inicio');
  await p.goto(`/t/${T.id}`); await shot(p, 'mov-torneo');
  await p.goto(`/t/${T.id}/c/${catFinished.id}`); await p.waitForTimeout(1200);
  const h = p.getByRole('heading', { name: 'Llave', exact: true }); await h.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -70)); await shot(p, 'mov-llave-grafico');
  await p.getByRole('button', { name: 'Vertical' }).click(); await shot(p, 'mov-llave-vertical');
  await p.getByRole('button', { name: 'Lista' }).click(); await shot(p, 'mov-llave-lista');
  await ctx.close();
}
/* ---------- Administración ---------- */
{
  const ctx = await browser.newContext({ ...DESK, baseURL: BASE }); await login(ctx, ADMIN); const p = await ctx.newPage();
  await p.goto('/admin'); await shot(p, 'adm-inicio');
  await p.goto('/admin/torneos'); await shot(p, 'adm-torneos');
  await p.goto('/admin/torneos?nuevo=1'); await shot(p, 'adm-torneo-nuevo', { wait: 1200 });
  const A = `/admin/torneos/${T.id}`;
  await p.goto(A); await shot(p, 'adm-resumen', { full: true });
  await p.goto(`${A}/configuracion`); await shot(p, 'adm-configuracion', { full: true });
  await p.goto(`${A}/categorias`); await shot(p, 'adm-categorias', { full: true });
  await p.getByRole('button', { name: /Generación asistida/ }).first().click().catch(() => {}); await shot(p, 'adm-categorias-asistida', { wait: 1200 });
  await p.keyboard.press('Escape');
  await p.goto(`${A}/inscripciones`); await shot(p, 'adm-inscripciones');
  await p.getByRole('button', { name: 'Inscribir', exact: true }).first().click(); await shot(p, 'adm-inscribir', { wait: 1200 });
  await p.keyboard.press('Escape');
  await p.goto(`${A}/pesaje`); await shot(p, 'adm-pesaje');
  await p.getByRole('button', { name: 'Sin pesar' }).click(); await p.getByRole('button', { name: 'Pesar', exact: true }).first().click(); await shot(p, 'adm-pesaje-formulario', { wait: 1000 });
  await p.goto(`${A}/llaves?c=${catLive.id}`); await shot(p, 'adm-llaves', { full: true, wait: 1500 });
  const btn = p.locator('[data-testid=bracket-content] button.card:not(.border-dashed)').first(); if (await btn.count()) { await btn.click(); await shot(p, 'adm-resultado-modal', { wait: 1200 }); await p.keyboard.press('Escape'); }
  await p.goto(`${A}/tatamis`); await shot(p, 'adm-tatamis', { full: true });
  await p.goto(`${A}/auditoria`); await shot(p, 'adm-auditoria');
  await p.goto(`${A}/exportar`); await shot(p, 'adm-exportar', { full: true });
  await p.goto('/admin/atletas'); await shot(p, 'adm-atletas');
  await p.getByRole('button', { name: 'Nuevo atleta' }).click(); await shot(p, 'adm-atleta-nuevo', { wait: 1200 }); await p.keyboard.press('Escape');
  // Importar: es un campo de archivo; se le pasa un CSV de ejemplo (la vista previa no guarda nada)
  await p.locator('input[type=file]').setInputFiles({ name: 'atletas.csv', mimeType: 'text/csv', buffer: Buffer.from('nombres,apellidos,documento,fechaNacimiento,genero,cinturon,academia,pesoDeclarado\nAna,García López,DOC-EJ-1,1998-04-12,F,Azul,Kimura Team,63.5\nLuis,Pérez Ruiz,DOC-EJ-2,1990-09-30,M,Blanca,Gracie Norte,78\n') });
  await shot(p, 'adm-atletas-importar', { wait: 1500 }); await p.keyboard.press('Escape');
  await p.goto('/admin/academias'); await shot(p, 'adm-academias');
  await p.goto('/admin/deportes'); await shot(p, 'adm-deportes', { full: true });
  await p.goto('/admin/usuarios'); await shot(p, 'adm-usuarios');
  await p.getByRole('button', { name: 'Nuevo usuario' }).click(); await shot(p, 'adm-usuario-nuevo', { wait: 1200 }); await p.keyboard.press('Escape');
  await ctx.close();
}
/* ---------- Admin en móvil ---------- */
{
  const ctx = await browser.newContext({ ...MOBILE, baseURL: BASE }); await login(ctx, ADMIN); const p = await ctx.newPage();
  await p.goto(`/admin/torneos/${T.id}`); await shot(p, 'mov-adm-resumen');
  await p.getByRole('button', { name: 'Abrir menú' }).click(); await shot(p, 'mov-adm-menu', { wait: 800 });
  await ctx.close();
}
/* ---------- Mesa de control (tablet) ---------- */
{
  const ctx = await browser.newContext({ ...TABLET, baseURL: BASE }); const token = await login(ctx, MESA); const p = await ctx.newPage();
  const me = await (await p.request.get(`${BASE}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } })).json();
  await p.goto('/mesa'); await shot(p, 'mesa-tatamis');
  const mat = me.mats[0];
  await p.goto(`/mesa/${mat.id}`); await shot(p, 'mesa-consola', { full: true });
  await p.getByRole('button', { name: 'Registrar ganador' }).first().click().catch(async () => p.getByRole('button', { name: /Registrar resultado/ }).first().click());
  await shot(p, 'mesa-registrar-ganador', { wait: 1200 }); await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Finalizados' }).click(); await p.locator('#done-h').scrollIntoViewIfNeeded(); await shot(p, 'mesa-finalizados');
  await ctx.close();
}
await browser.close();
