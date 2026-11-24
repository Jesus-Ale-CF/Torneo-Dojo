import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiLogin, uid } from './helpers';

/**
 * Regresión de la llave:
 * - < 768 px: árbol vertical que cabe en el ancho (sin scroll horizontal).
 * - ≥ 768 px: se auto-ajusta al ancho; la rueda sin Ctrl desplaza la PÁGINA y no mueve la llave;
 *   Ctrl+rueda hace zoom; el arrastre está limitado; "Ajustar a pantalla" y doble clic restablecen.
 * Cada tamaño de llave se genera en un torneo propio que se borra al final.
 */
const SIZES = [4, 6, 8, 13, 16]; // 6 y 13 → BYEs
const WIDTHS = [360, 390, 768, 1024, 1440];

type Fixture = { tid: string; cid: string; athletes: string[] };
const fixtures = new Map<number, Fixture>();
let token = '';

async function makeBracket(request: APIRequestContext, n: number): Promise<Fixture> {
  const h = { authorization: `Bearer ${token}` };
  const sport = (await (await request.get('/api/sports')).json()).find((s: { slug: string }) => s.slug === 'bjj');
  const t = await (await request.post('/api/tournaments', { headers: h, data: { name: `Llave E2E ${n} ${uid()}`, venue: 'Dojo E2E', startDate: '2026-12-01', endDate: '2026-12-01', sportId: sport.id, status: 'IN_PROGRESS' } })).json();
  const c = await (await request.post(`/api/tournaments/${t.id}/categories`, { headers: h, data: { name: `Absoluto ${n}`, gender: 'X', format: 'SINGLE_ELIMINATION', avoidSameAcademy: false } })).json();
  const athletes: string[] = [];
  for (let i = 0; i < n; i++) {
    const doc = `E2E${uid()}${i}`;
    const a = await (await request.post('/api/athletes', { headers: h, data: { firstName: `Atleta${i + 1}`, lastName: `Apellido Compuesto Largo ${i + 1}`, document: doc, birthDate: '1995-01-01', gender: 'M' } })).json();
    athletes.push(a.id);
    await request.post(`/api/tournaments/${t.id}/registrations`, { headers: h, data: { athleteId: a.id, categoryId: c.id, autoAssign: false } });
  }
  const g = await request.post(`/api/categories/${c.id}/bracket/generate`, { headers: h, data: { manualSeeding: false } });
  expect(g.ok()).toBeTruthy();
  return { tid: t.id, cid: c.id, athletes };
}

test.beforeAll(async ({ request }) => {
  token = await apiLogin(request);
  for (const n of SIZES) fixtures.set(n, await makeBracket(request, n));
});
test.afterAll(async ({ request }) => {
  const h = { authorization: `Bearer ${token}` };
  for (const f of fixtures.values()) {
    await request.delete(`/api/tournaments/${f.tid}`, { headers: h });
    for (const a of f.athletes) await request.delete(`/api/athletes/${a}`, { headers: h });
  }
});

const transformOf = (page: Page) => page.getByTestId('bracket-content').evaluate((el) => (el as HTMLElement).style.transform);
const scaleOf = async (page: Page) => Number((await transformOf(page)).match(/scale\(([\d.]+)\)/)?.[1] ?? 1);
/** Fracción del lienzo ocupada por contenido (0 = lienzo vacío). */
const visibleFraction = (page: Page) => page.evaluate(() => {
  const vp = document.querySelector('[data-testid=bracket-viewport]')!.getBoundingClientRect();
  const ct = document.querySelector('[data-testid=bracket-content]')!.getBoundingClientRect();
  const w = Math.max(0, Math.min(vp.right, ct.right) - Math.max(vp.left, ct.left));
  const h = Math.max(0, Math.min(vp.bottom, ct.bottom) - Math.max(vp.top, ct.top));
  return (w * h) / (vp.width * vp.height);
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of WIDTHS) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({ viewport: { width, height: width < 768 ? 800 : 900 }, colorScheme: theme, hasTouch: width < 768, isMobile: width < 768 });

      for (const n of SIZES) {
        test(`llave de ${n}: cabe y no se pierde con la rueda`, async ({ page }) => {
          const f = fixtures.get(n)!;
          await page.goto(`/t/${f.tid}/c/${f.cid}`);
          await expect(page.getByRole('heading', { name: 'Llave', exact: true })).toBeVisible();

          // Nunca hay desbordamiento horizontal de la página
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(1);

          if (width < 768) {
            // Móvil: el mismo gráfico, a tamaño legible; se desliza a los lados y la página hace el scroll vertical
            const vpm = page.getByTestId('bracket-viewport');
            await expect(vpm).toBeVisible();
            const r = (await vpm.boundingBox())!;
            expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.width).toBeLessThanOrEqual(width);
            const s0 = await scaleOf(page);
            expect(s0).toBeGreaterThan(0.5);
            const first = (await page.locator('[data-testid=bracket-content] .card').first().boundingBox())!;
            expect(first.x).toBeGreaterThanOrEqual(r.x);
            expect(first.x + first.width).toBeLessThanOrEqual(r.x + r.width + 1);
            // La rueda/scroll desplaza la página con normalidad y no mueve la llave
            const before = await transformOf(page);
            await vpm.hover();
            await page.mouse.wheel(0, 600);
            await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
            expect(await transformOf(page)).toBe(before);
            // "Ver completa" muestra toda la llave dentro del lienzo
            const full = page.getByRole('button', { name: 'Ver completa' });
            if (await full.count()) {
              await full.click();
              await expect.poll(() => scaleOf(page)).toBeLessThan(s0);
              await expect.poll(() => page.evaluate(() => { const a = document.querySelector('[data-testid=bracket-viewport]')!.getBoundingClientRect(); const b = document.querySelector('[data-testid=bracket-content]')!.getBoundingClientRect(); return a.right - b.right; })).toBeGreaterThanOrEqual(0);
            }
            // La vista vertical sigue disponible
            await page.getByRole('button', { name: 'Vertical' }).click();
            await expect(page.getByTestId('bracket-vertical')).toBeVisible();
            return;
          }

          const vp = page.getByTestId('bracket-viewport');
          await expect(vp).toBeVisible();
          // Auto-ajuste: el contenido escalado entra en el ancho del lienzo
          const fit = await page.evaluate(() => {
            const a = document.querySelector('[data-testid=bracket-viewport]')!.getBoundingClientRect();
            const b = document.querySelector('[data-testid=bracket-content]')!.getBoundingClientRect();
            return { left: b.left - a.left, right: a.right - b.right };
          });
          expect(fit.left).toBeGreaterThanOrEqual(0);
          expect(fit.right).toBeGreaterThanOrEqual(0);
          const fitScale = await scaleOf(page);

          // Rueda normal (trackpad de dos dedos): mueve la página, NO la llave
          const before = await transformOf(page);
          await vp.scrollIntoViewIfNeeded();
          const y0 = await page.evaluate(() => scrollY);
          const box = (await vp.boundingBox())!;
          await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
          for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 120);
          await page.waitForTimeout(200);
          expect(await transformOf(page)).toBe(before);
          const docScrollable = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 5);
          if (docScrollable) expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y0);
          for (let i = 0; i < 6; i++) await page.mouse.wheel(40, -120); // también con componente horizontal
          await page.waitForTimeout(200);
          expect(await transformOf(page)).toBe(before);

          // Ctrl + rueda → zoom; la llave sigue visible
          await vp.scrollIntoViewIfNeeded();
          const b2 = (await vp.boundingBox())!;
          await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
          await page.keyboard.down('Control');
          for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
          await page.keyboard.up('Control');
          await expect.poll(() => scaleOf(page)).toBeGreaterThan(fitScale);
          expect(await visibleFraction(page)).toBeGreaterThan(0.2);

          // Arrastre exagerado en todas direcciones: limitado, nunca queda vacío el lienzo
          for (const [dx, dy] of [[2000, 2000], [-4000, -4000], [3000, -3000]]) {
            await page.mouse.move(b2.x + 20, b2.y + 20);
            await page.mouse.down();
            await page.mouse.move(b2.x + 20 + dx, b2.y + 20 + dy, { steps: 6 });
            await page.mouse.up();
            expect(await visibleFraction(page)).toBeGreaterThan(0.2);
          }

          // "Ajustar a pantalla" y doble clic restablecen el encaje
          await page.getByRole('button', { name: 'Ajustar a pantalla' }).click();
          await expect.poll(() => scaleOf(page)).toBeCloseTo(fitScale, 2);
          await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control');
          await page.mouse.dblclick(b2.x + 6, b2.y + 6);
          await expect.poll(() => scaleOf(page)).toBeCloseTo(fitScale, 2);
        });
      }
    });
  }
}

test.describe('Vista lista', () => {
  test('sigue disponible como alternativa', async ({ page }) => {
    const f = fixtures.get(8)!;
    await page.goto(`/t/${f.tid}/c/${f.cid}`);
    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByTestId('bracket-viewport')).toHaveCount(0);
    await expect(page.getByText('Cuartos de final').first()).toBeVisible();
  });
});
