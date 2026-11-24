import { expect, test } from '@playwright/test';
import { ADMIN, MESA, apiLogin, expectNoHorizontalOverflow, expectPageAlive, firstTournamentId, loginAs, watchErrors } from './helpers';

const TABS = ['resumen', 'configuracion', 'categorias', 'inscripciones', 'pesaje', 'llaves', 'tatamis', 'auditoria', 'exportar'];
const ADMIN_PAGES = ['/admin', '/admin/torneos', '/admin/atletas', '/admin/academias', '/admin/deportes', '/admin/usuarios'];

test.describe('Admin', () => {
  for (const vp of [{ n: 'móvil', width: 390, height: 800 }, { n: 'tablet', width: 768, height: 900 }, { n: 'escritorio', width: 1440, height: 900 }]) {
    test(`pantallas y 9 pestañas del torneo · ${vp.n}`, async ({ page, request }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const guard = watchErrors(page);
      const tid = await firstTournamentId(request);
      await loginAs(page, ADMIN, '/admin');
      for (const p of ADMIN_PAGES) {
        await page.goto(p);
        await expectPageAlive(page);
        await expectNoHorizontalOverflow(page);
      }
      await page.goto(`/admin/torneos/${tid}`);
      await expectPageAlive(page);
      for (const tab of TABS) {
        // clic real en la pestaña (no goto)
        await page.getByRole('tab', { name: new RegExp(tab === 'configuracion' ? 'Configuraci' : tab === 'categorias' ? 'Categor' : tab === 'auditoria' ? 'Auditor' : tab, 'i') }).click();
        await expect(page).toHaveURL(new RegExp(`/${tab}(\\?.*)?$`));
        await expect(page.getByRole('tabpanel')).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      await page.reload(); // F5 en una ruta profunda de admin
      await expect(page.getByRole('tabpanel')).toBeVisible();
      guard.assertClean();
    });
  }
});

test.describe('Mesa y sesión', () => {
  test('la mesa no entra a rutas de admin y puede abrir su panel', async ({ page }) => {
    const guard = watchErrors(page);
    await loginAs(page, MESA, '/mesa');
    await expectPageAlive(page);
    for (const p of ['/admin', '/admin/usuarios', '/admin/torneos']) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/mesa$/);
    }
    guard.assertClean();
  });

  test('sin sesión, /admin y /mesa llevan al login; con token inválido se limpia la sesión', async ({ page }) => {
    const guard = watchErrors(page, [/401|Unauthorized/]);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
    await page.addInitScript(() => localStorage.setItem('zenkai-token', 'token.invalido.xyz'));
    await page.goto('/mesa');
    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('zenkai-token'))).toBeNull();
    guard.assertClean();
  });

  test('cerrar sesión borra el token y lleva al login', async ({ page }) => {
    const guard = watchErrors(page);
    await loginAs(page, ADMIN, '/admin');
    await page.getByRole('button', { name: /Cerrar sesión|Salir/ }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    // (loginAs reinyecta el token en cada carga, así que se comprueba el almacenamiento y no una recarga)
    expect(await page.evaluate(() => localStorage.getItem('zenkai-token'))).toBeNull();
    guard.assertClean();
  });

  test('un usuario desactivado pierde el acceso en la siguiente petición', async ({ page, request }) => {
    const adminToken = await apiLogin(request, ADMIN);
    const auth = { Authorization: `Bearer ${adminToken}` };
    const email = `tmp${Date.now().toString(36)}@zenkai.dojo`;
    const created = await request.post('/api/users', { headers: auth, data: { name: 'Temporal', email, password: 'temporal123', role: 'TABLE' } });
    expect(created.ok(), await created.text()).toBeTruthy();
    const u = await created.json();
    try {
      const guard = watchErrors(page, [/401|403|Unauthorized/]);
      await loginAs(page, { email, password: 'temporal123' }, '/mesa');
      await expectPageAlive(page);
      const off = await request.patch(`/api/users/${u.id}`, { headers: auth, data: { active: false } });
      expect(off.ok(), await off.text()).toBeTruthy();
      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
      guard.assertClean();
    } finally {
      await request.delete(`/api/users/${u.id}`, { headers: auth });
    }
  });
});

test.describe('Tiempo real', () => {
  test('un combate iniciado desde la mesa aparece en la llave pública sin perder el zoom', async ({ browser, request }) => {
    const mesaToken = await apiLogin(request, MESA);
    const auth = { Authorization: `Bearer ${mesaToken}` };
    const tid = await firstTournamentId(request);
    const me = await (await request.get('/api/auth/me', { headers: auth })).json();
    const matIds: string[] = (me.user ?? me).mats.map((m: { id: string }) => m.id);
    // Busca un combate PENDING con los dos lados definidos en un tatami de la mesa
    let target: { id: string; catId: string } | null = null;
    for (const matId of matIds) {
      const ms = await (await request.get(`/api/mats/${matId}/matches`, { headers: auth })).json();
      const m = ms.find((x: { status: string; red: unknown; blue: unknown }) => x.status === 'PENDING' && x.red && x.blue);
      if (m) { target = { id: m.id, catId: m.categoryId }; break; }
    }
    test.skip(!target, 'El seed no tiene un combate PENDING completo en los tatamis de la mesa');

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const guard = watchErrors(page);
    await page.goto(`/t/${tid}/c/${target!.catId}`);
    const vp = page.getByTestId('bracket-viewport');
    await expect(vp).toBeVisible();
    await page.keyboard.down('Control'); await vp.hover(); await page.mouse.wheel(0, -300); await page.keyboard.up('Control');
    const before = await page.getByTestId('bracket-content').evaluate((e) => (e as HTMLElement).style.transform);
    const live = page.getByText('En curso', { exact: true });
    const base = await live.count();
    try {
      const s = await request.post(`/api/matches/${target!.id}/start`, { headers: auth });
      expect(s.ok(), await s.text()).toBeTruthy();
      await expect(live).toHaveCount(base + 1, { timeout: 12_000 });
      const after = await page.getByTestId('bracket-content').evaluate((e) => (e as HTMLElement).style.transform);
      expect(after, 'el zoom/posición no debe reiniciarse al actualizar').toBe(before);
    } finally {
      await request.post(`/api/matches/${target!.id}/cancel-start`, { headers: auth });
    }
    await expect(live).toHaveCount(base, { timeout: 12_000 });
    guard.assertClean();
    await ctx.close();
  });
});
