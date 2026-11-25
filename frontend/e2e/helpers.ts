import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

export const ADMIN = { email: 'admin@torneo.dojo', password: 'admin123' };
export const MESA = { email: 'mesa@torneo.dojo', password: 'mesa123' };
export const uid = () => Date.now().toString(36).slice(-5);

// Un token por usuario y proceso: el login tiene límite de intentos (10 cada 15 min por IP y correo)
const tokens = new Map<string, string>();
export async function apiLogin(request: APIRequestContext, who = ADMIN): Promise<string> {
  const cached = tokens.get(who.email);
  if (cached) return cached;
  const r = await request.post('/api/auth/login', { data: who });
  expect(r.ok(), `login ${who.email} → ${r.status()}`).toBeTruthy();
  const token = (await r.json()).token as string;
  tokens.set(who.email, token);
  return token;
}

/** Inicia sesión inyectando el token (rápido) y abre `path`. */
export async function loginAs(page: Page, who = ADMIN, path = '/admin') {
  const token = await apiLogin(page.request, who);
  // El token se escribe antes de que cargue cualquier documento: sin carreras con la navegación
  await page.addInitScript((t) => { try { localStorage.setItem('zenkai-token', t); } catch { /* sin almacenamiento */ } }, token);
  await page.goto(path);
}

export async function firstTournamentId(request: APIRequestContext): Promise<string> {
  const r = await request.get('/api/public/tournaments');
  return (await r.json())[0].id as string;
}

/**
 * Escribe tecla a tecla (eventos reales de teclado) en un campo y comprueba
 * que el foco no sale de él y que el valor final es el escrito.
 */
export async function typeAndKeepFocus(field: Locator, text: string, expected = text) {
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.press('Backspace');
  await field.page().keyboard.type(text, { delay: 15 });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(expected);
}

/**
 * Vigila errores del navegador: `pageerror` (excepciones no capturadas), `console.error` y respuestas 5xx.
 * Llama a `assertClean()` al final de la prueba: falla si apareció cualquiera (salvo los `allow`).
 */
export function watchErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  const keep = (t: string) => !allow.some((r) => r.test(t));
  page.on('pageerror', (e) => { const t = `pageerror: ${e.message}`; if (keep(t)) errors.push(t); });
  page.on('console', (m) => { if (m.type() === 'error') { const t = `console.error: ${m.text()}`; if (keep(t)) errors.push(t); } });
  page.on('response', (r) => { if (r.status() >= 500) { const t = `HTTP ${r.status()} ${r.url()}`; if (keep(t)) errors.push(t); } });
  return { errors, assertClean: () => expect(errors, `Errores del navegador:\n${errors.join('\n')}`).toEqual([]) };
}

/** La página no está en blanco ni invisible: hay un h1 visible y el contenedor raíz tiene opacidad 1. */
export async function expectPageAlive(page: Page, h1?: RegExp) {
  const heading = h1 ? page.getByRole('heading', { level: 1, name: h1 }) : page.getByRole('heading', { level: 1 }).first();
  await expect(heading).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#root > div')!).opacity)).toBe('1');
}

/** Sin desborde horizontal de la página. */
export async function expectNoHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, 'desborde horizontal (px)').toBeLessThanOrEqual(1);
}
