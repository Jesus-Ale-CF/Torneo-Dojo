import { expect, test, type Page } from '@playwright/test';
import { ADMIN, MESA, apiLogin, firstTournamentId, loginAs, typeAndKeepFocus, uid } from './helpers';

/**
 * Regresión del problema "el foco salta al botón Cerrar mientras escribo".
 * Se escribe con pulsaciones reales en cada campo de texto de cada modal con formulario.
 */
type Case = { name: string; path: (tid: string) => string; open: (p: Page) => Promise<void>; fields: [label: string, text: string, expected?: string][] };

const cases: Case[] = [
  { name: 'Nuevo torneo', path: () => '/admin/torneos', open: (p) => p.getByRole('button', { name: 'Nuevo torneo' }).click(),
    fields: [['Nombre del torneo', 'Open de Primavera'], ['Sede', 'Polideportivo Norte'], ['Ciudad', 'Málaga'], ['Oro', '12'], ['Plata', '5'], ['Bronce', '2'], ['Descripción (pública)', 'Torneo abierto, todas las edades.']] },
  { name: 'Nuevo deporte', path: () => '/admin/deportes', open: async (p) => { await p.getByRole('button', { name: 'Nuevo deporte' }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Añadir método' }).click(); },
    fields: [['Nombre', 'Sambo'], ['Duración por defecto (segundos)', '240'], ['Descripción', 'Lucha rusa'], ['Código del método 2', 'tkd', 'TKD'], ['Nombre del método 2', 'Derribo total'], ['Nombre del cinturón 1', 'Rojo']] },
  { name: 'Nueva academia', path: () => '/admin/academias', open: (p) => p.getByRole('button', { name: 'Nueva academia' }).click(),
    fields: [['Nombre', 'Dojo del Sur'], ['Abreviatura', 'dds', 'DDS'], ['Ciudad', 'Cádiz']] },
  { name: 'Nuevo usuario', path: () => '/admin/usuarios', open: (p) => p.getByRole('button', { name: 'Nuevo usuario' }).click(),
    fields: [['Nombre', 'Mesa Tres'], ['Correo', 'mesa3@torneo.dojo'], ['Contraseña', 'secreta123']] },
  { name: 'Nuevo atleta', path: () => '/admin/atletas', open: (p) => p.getByRole('button', { name: 'Nuevo atleta' }).click(),
    fields: [['Nombres', 'Lucía'], ['Apellidos', 'Fernández Ruiz'], ['Documento', 'X1234567'], ['Correo', 'lucia@example.com'], ['Teléfono', '+34 600 111 222']] },
  { name: 'Nueva categoría', path: (t) => `/admin/torneos/${t}/categorias`, open: (p) => p.getByRole('button', { name: 'Nueva', exact: true }).click(),
    fields: [['Nombre (vacío = automático)', 'Adulto Absoluto'], ['Duración del combate (s)', '420']] },
  { name: 'Inscribir atleta', path: (t) => `/admin/torneos/${t}/inscripciones`, open: (p) => p.getByRole('tabpanel').getByRole('button', { name: 'Inscribir' }).click(),
    fields: [['Buscar atleta', 'Hugo']] },
  { name: 'Editar inscripción', path: (t) => `/admin/torneos/${t}/inscripciones`, open: (p) => p.getByRole('button', { name: /^Editar inscripción de/ }).first().click(),
    fields: [['Siembra (1 = mejor)', '3']] },
];

test.describe('El foco se queda en el campo al escribir en modales', () => {
  let tid = '';
  test.beforeAll(async ({ request }) => { tid = await firstTournamentId(request); });

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      await loginAs(page, ADMIN, c.path(tid));
      await c.open(page);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // El foco inicial va a un campo, nunca al botón Cerrar
      await expect(dialog.getByRole('button', { name: 'Cerrar' })).not.toBeFocused();
      for (const [label, text, expected] of c.fields) {
        await typeAndKeepFocus(dialog.getByLabel(label, { exact: true }), text, expected ?? text);
      }
      // Tras escribir en todos los campos, cada valor sigue intacto
      for (const [label, text, expected] of c.fields) await expect(dialog.getByLabel(label, { exact: true })).toHaveValue(expected ?? text);
      // Esc cierra y el foco no queda perdido
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }

  test('Peso declarado al inscribir', async ({ page, request }) => {
    // Atleta propio sin inscribir (en el seed todos están inscritos en el torneo)
    const token = await apiLogin(request);
    const auth = { authorization: `Bearer ${token}` };
    const doc = `E2E${uid()}`;
    const a = await (await request.post('/api/athletes', { headers: auth, data: { firstName: 'Prueba', lastName: `Peso ${doc}`, document: doc, birthDate: '1995-05-05', gender: 'M' } })).json();
    try {
      await loginAs(page, ADMIN, `/admin/torneos/${tid}/inscripciones`);
      await page.getByRole('tabpanel').getByRole('button', { name: 'Inscribir' }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Buscar atleta').pressSequentially(doc);
      await d.locator('ul li button').first().click();
      await typeAndKeepFocus(d.getByLabel('Peso declarado (kg)'), '72.5');
    } finally {
      await request.delete(`/api/athletes/${a.id}`, { headers: auth });
    }
  });

  test('Motivo de corrección en la mesa de control', async ({ page }) => {
    await loginAs(page, MESA, '/mesa');
    await page.getByRole('link', { name: /Tatami 1/ }).click();
    await page.getByRole('button', { name: 'Finalizados' }).click();
    await page.locator('section', { hasText: 'Finalizados (toca para corregir)' }).locator('button').first().click();
    const d = page.getByRole('dialog');
    await d.getByRole('button').filter({ hasText: 'Rojo' }).click();
    await typeAndKeepFocus(d.getByLabel('Motivo de la corrección'), 'Error al anotar la esquina');
  });

  test('Tab queda atrapado dentro del modal', async ({ page }) => {
    await loginAs(page, ADMIN, '/admin/academias');
    await page.getByRole('button', { name: 'Nueva academia' }).click();
    const d = page.getByRole('dialog');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await d.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });
});
