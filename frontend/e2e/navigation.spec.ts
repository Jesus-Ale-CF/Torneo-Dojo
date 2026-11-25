import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, expectPageAlive, firstTournamentId, watchErrors } from './helpers';

const HOME = /Torneos de combate/;

test.describe('Navegación pública', () => {
  test('categoría → logo → inicio, sin pantalla en negro ni errores (bug de la sesión 5)', async ({ page, request }) => {
    const guard = watchErrors(page);
    const tid = await firstTournamentId(request);
    const cats = await (await request.get(`/api/public/tournaments/${tid}/categories`)).json();
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      for (const c of cats) {
        // Llegar a la categoría navegando (clic desde el torneo), como un usuario real
        await page.goto(`/t/${tid}`);
        await page.locator(`a[href="/t/${tid}/c/${c.id}"]`).first().click();
        await expect(page).toHaveURL(new RegExp(`/c/${c.id}$`));
        await expectPageAlive(page, /./);
        await page.getByRole('link', { name: /Torneo Dojo, inicio/ }).click();
        await expect(page).toHaveURL(/\/$/);
        await expectPageAlive(page, HOME);
        await expect(page.getByRole('banner')).toBeVisible();
      }
    }
    guard.assertClean();
  });

  test('categoría → logo con la llave manipulada (arrastre y zoom) y tras un ciclo de polling', async ({ page, request }) => {
    const guard = watchErrors(page);
    const tid = await firstTournamentId(request);
    const cats = await (await request.get(`/api/public/tournaments/${tid}/categories`)).json();
    await page.goto(`/t/${tid}`);
    await page.locator(`a[href="/t/${tid}/c/${cats[0].id}"]`).first().click();
    const vp = page.getByTestId('bracket-viewport');
    await expect(vp).toBeVisible();
    const b = (await vp.boundingBox())!;
    await page.mouse.move(b.x + 100, b.y + 60); await page.mouse.down(); await page.mouse.move(b.x + 40, b.y + 70, { steps: 4 }); await page.mouse.up();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -400); await page.keyboard.up('Control');
    await page.waitForTimeout(5500);
    await page.getByRole('link', { name: /Torneo Dojo, inicio/ }).click();
    await expectPageAlive(page, HOME);
    guard.assertClean();
  });

  test('atrás/adelante y recarga en rutas profundas', async ({ page, request }) => {
    const guard = watchErrors(page);
    const tid = await firstTournamentId(request);
    const cats = await (await request.get(`/api/public/tournaments/${tid}/categories`)).json();
    const cat = `/t/${tid}/c/${cats[0].id}`;
    await page.goto('/');
    await page.getByRole('link', { name: 'Torneos', exact: true }).first().click();
    await expectPageAlive(page, /^Torneos$/);
    await page.goto(cat);
    await expectPageAlive(page, /./);
    await page.reload();
    await expectPageAlive(page, /./);
    await page.goBack();
    await expectPageAlive(page, /^Torneos$/);
    await page.goForward();
    await expectPageAlive(page, /./);
    await page.goto(`/t/${tid}/tv`);
    await page.reload();
    await expect(page.locator('#root')).not.toBeEmpty();
    guard.assertClean();
  });

  for (const vp of [{ n: 'móvil', width: 390, height: 800 }, { n: 'tablet', width: 768, height: 900 }, { n: 'escritorio', width: 1440, height: 900 }]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`recorrido de rutas públicas · ${vp.n} · ${scheme}`, async ({ browser, request }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: scheme });
        const page = await ctx.newPage();
        const guard = watchErrors(page);
        const tid = await firstTournamentId(request);
        const cats = await (await request.get(`/api/public/tournaments/${tid}/categories`)).json();
        const nav = vp.width < 640 ? page.getByRole('navigation', { name: 'Principal móvil' }) : page.getByRole('navigation', { name: 'Principal', exact: true });
        await page.goto('/');
        await expectPageAlive(page, HOME);
        await nav.getByRole('link', { name: 'Torneos' }).click();
        await expectPageAlive(page, /^Torneos$/);
        await nav.getByRole('link', { name: 'Inicio' }).click();
        await expectPageAlive(page, HOME);
        await page.locator(`a[href="/t/${tid}"]`).first().click();
        await expectPageAlive(page, /./);
        await expectNoHorizontalOverflow(page);
        for (const c of cats) {
          await page.locator(`a[href="/t/${tid}/c/${c.id}"]`).first().click();
          await expectPageAlive(page, /./);
          await expectNoHorizontalOverflow(page);
          await page.goBack();
          await expectPageAlive(page, /./);
        }
        await page.goto(`/t/${tid}/tv`);
        await expect(page.locator('#root')).not.toBeEmpty();
        await expectNoHorizontalOverflow(page);
        guard.assertClean();
        await ctx.close();
      });
    }
  }
});

test.describe('Error Boundary', () => {
  test('un fallo de render muestra "Algo salió mal" con el header intacto, y Reintentar se recupera', async ({ page }) => {
    // Datos corruptos: falta `_count`/`mats`, HomePage lanza al renderizar
    let broken = true;
    await page.route('**/api/public/tournaments', (route) => broken
      ? route.fulfill({ json: [{ id: 'x', name: 'Roto', status: 'IN_PROGRESS' }] })
      : route.continue());
    const guard = watchErrors(page, [/Roto|_count|mats|Cannot read|\[ErrorBoundary/, /The above error occurred/]);
    await page.goto('/');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Algo salió mal');
    await expect(page.getByRole('banner')).toBeVisible(); // el header sigue (límite por página)
    await expect(alert.getByRole('link', { name: 'Volver al inicio' })).toBeVisible();
    broken = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await page.reload();
    await expectPageAlive(page, HOME);
    void guard;
  });

  test('el error se registra en consola con ruta y componente', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
    await page.route('**/api/public/tournaments', (route) => route.fulfill({ json: [{ id: 'x', name: 'Roto', status: 'IN_PROGRESS' }] }));
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();
    expect(logs.some((l) => l.includes('[ErrorBoundary:página] ruta=/ componente='))).toBeTruthy();
  });

  test('el guardián detecta un pageerror', async ({ page }) => {
    const guard = watchErrors(page);
    await page.goto('/');
    await page.evaluate(() => { setTimeout(() => { throw new Error('boom'); }, 0); });
    await expect.poll(() => guard.errors.length).toBeGreaterThan(0);
    expect(() => guard.assertClean()).toThrow();
  });
});
