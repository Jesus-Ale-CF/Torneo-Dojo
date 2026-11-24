import { expect, test } from '@playwright/test';
import { ADMIN, apiLogin, loginAs, uid } from './helpers';

/** Regresión de "Datos inválidos" genérico: guardado con datos reales y errores por campo. */
test.describe('Crear torneo y deporte', () => {
  const created: { kind: 'tournaments' | 'sports'; id: string }[] = [];
  test.afterAll(async ({ request }) => {
    const token = await apiLogin(request);
    for (const c of created) await request.delete(`/api/${c.kind}/${c.id}`, { headers: { authorization: `Bearer ${token}` } });
  });

  test('torneo con datos válidos se guarda', async ({ page }) => {
    const name = `Open de Primavera ${uid()}`;
    await loginAs(page, ADMIN, '/admin/torneos');
    await page.getByRole('button', { name: 'Nuevo torneo' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nombre del torneo').pressSequentially(name);
    await d.getByLabel('Sede', { exact: true }).pressSequentially('Polideportivo Norte');
    await d.getByLabel('Ciudad').pressSequentially('Sevilla');
    const resp = page.waitForResponse((r) => r.url().endsWith('/api/tournaments') && r.request().method() === 'POST');
    await d.getByRole('button', { name: 'Crear torneo' }).click();
    const r = await resp;
    expect(r.status()).toBe(201);
    created.push({ kind: 'tournaments', id: (await r.json()).id });
    await expect(page.getByText('Torneo creado')).toBeVisible();
    await expect(page.getByRole('link', { name })).toBeVisible();
  });

  test('torneo con datos inválidos muestra errores por campo y no envía nada', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/tournaments') && r.method() === 'POST') posted = true; });
    await loginAs(page, ADMIN, '/admin/torneos');
    await page.getByRole('button', { name: 'Nuevo torneo' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nombre del torneo').pressSequentially('Op');
    await d.getByLabel('Fecha de fin').fill('2020-01-01');
    await d.getByRole('button', { name: 'Crear torneo' }).click();
    await expect(d.getByText('Debe tener al menos 3 caracteres')).toBeVisible();
    await expect(d.getByText('Este campo es obligatorio')).toBeVisible(); // sede vacía
    await expect(d.getByText('La fecha de fin no puede ser anterior a la de inicio')).toBeVisible();
    await expect(d.getByLabel('Nombre del torneo')).toHaveAttribute('aria-invalid', 'true');
    await expect(d.getByLabel('Nombre del torneo')).toBeFocused(); // foco al primer campo inválido
    await expect(page.getByText('Revisa los campos marcados')).toBeVisible();
    expect(posted).toBe(false);
    // Al corregir el campo su error desaparece
    await d.getByLabel('Nombre del torneo').pressSequentially('en');
    await expect(d.getByText('Debe tener al menos 3 caracteres')).toBeHidden();
  });

  test('deporte con datos válidos se guarda', async ({ page }) => {
    const name = `Sambo ${uid()}`;
    await loginAs(page, ADMIN, '/admin/deportes');
    await page.getByRole('button', { name: 'Nuevo deporte' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nombre', { exact: true }).pressSequentially(name);
    await d.getByLabel('Descripción').pressSequentially('Lucha de origen ruso');
    await d.getByRole('button', { name: 'Añadir método' }).click();
    await d.getByLabel('Código del método 2').pressSequentially('sub');
    await d.getByLabel('Nombre del método 2').pressSequentially('Sumisión');
    await d.getByLabel('Nombre del cinturón 1').fill('Rojo');
    const resp = page.waitForResponse((r) => r.url().endsWith('/api/sports') && r.request().method() === 'POST');
    await d.getByRole('button', { name: 'Guardar' }).click();
    const r = await resp;
    expect(r.status()).toBe(201);
    created.push({ kind: 'sports', id: (await r.json()).id });
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('deporte: fila vacía marca el campo concreto (validación de cliente)', async ({ page }) => {
    await loginAs(page, ADMIN, '/admin/deportes');
    await page.getByRole('button', { name: 'Nuevo deporte' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nombre', { exact: true }).pressSequentially(`Kudo ${uid()}`);
    await d.getByRole('button', { name: 'Añadir método' }).click();
    await d.getByRole('button', { name: 'Guardar' }).click();
    await expect(d.getByLabel('Código del método 2')).toHaveAttribute('aria-invalid', 'true');
    await expect(d.getByLabel('Nombre del método 2')).toHaveAttribute('aria-invalid', 'true');
    await expect(d.getByText('Este campo es obligatorio').first()).toBeVisible();
  });

  test('deporte duplicado: el servidor marca el campo nombre', async ({ page }) => {
    await loginAs(page, ADMIN, '/admin/deportes');
    await page.getByRole('button', { name: 'Nuevo deporte' }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nombre', { exact: true }).pressSequentially('Judo');
    await d.getByRole('button', { name: 'Guardar' }).click();
    await expect(d.getByText('Ya existe un registro con este valor')).toBeVisible();
    await expect(d.getByLabel('Nombre', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  });
});

test('login: correo vacío marca el campo con mensaje en español', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Contraseña').pressSequentially('loquesea');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Correo electrónico no válido')).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
});
