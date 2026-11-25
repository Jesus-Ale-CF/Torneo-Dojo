/**
 * Capturas del manual de usuario (docs/manual/img). Requiere la app y el backend levantados
 * con los datos de demostración recién cargados (`npm run seed` en backend).
 *   node scripts/manual-shots.mjs                      → http://localhost:5173
 *   BASE=http://localhost:8080 node scripts/manual-shots.mjs
 * Escritorio 1440 px (administración), tablet 768 px (mesa), móvil 390 px (público). Siempre tema claro.
 * No cambia los datos: los formularios se rellenan y se cierran sin enviar (solo se crea y se borra un atleta de ejemplo).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/manual/img');
mkdirSync(OUT, { recursive: true });
const COMMON = { locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: 'light', baseURL: BASE, reducedMotion: 'reduce' };
const DESK = { ...COMMON, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const TABLET = { ...COMMON, viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PHONE = { ...COMMON, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const TV = { ...COMMON, viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.5 };
// Credenciales del seed de desarrollo: solo se usan aquí para entrar, nunca aparecen en las capturas.
const ADMIN = { email: 'admin@torneo.dojo', password: 'admin123' };
const MESA = { email: 'mesa@torneo.dojo', password: 'mesa123' };
const MESA2 = { email: 'mesa2@torneo.dojo', password: 'mesa123' };

const browser = await chromium.launch();

/** Contexto con tema claro forzado y, opcionalmente, sesión iniciada. */
async function context(opts, who) {
  const ctx = await browser.newContext(opts);
  let token = null;
  if (who) token = (await (await ctx.request.post('/api/auth/login', { data: who })).json()).token;
  await ctx.addInitScript((t) => {
    localStorage.setItem('zenkai-theme', 'light');
    if (t) localStorage.setItem('zenkai-token', t);
  }, token);
  return { ctx, page: await ctx.newPage(), token };
}

/**
 * Recuadro dorado (con número opcional) alrededor de lo que hay que pulsar.
 * No desplaza la página: así los recuadros anteriores no se descolocan.
 * side: dónde va el número — 'tl' (arriba a la izquierda), 'tr', 'l' (izquierda, centrado), 'r', 'b' (debajo).
 */
async function mark(page, target, n, side = 'tl') {
  const loc = typeof target === 'string' ? page.locator(target) : target;
  if (!(await loc.count())) { console.warn('  ⚠ no está en pantalla, sin recuadro', n ?? ''); return; }
  const b = await loc.first().boundingBox();
  if (!b) { console.warn('  ⚠ sin caja para el recuadro', n ?? ''); return; }
  await page.evaluate(({ b, n, side }) => {
    const pad = 5;
    const d = document.createElement('div');
    d.className = '__mark';
    Object.assign(d.style, {
      position: 'absolute', left: `${b.x + scrollX - pad}px`, top: `${b.y + scrollY - pad}px`,
      width: `${b.width + pad * 2}px`, height: `${b.height + pad * 2}px`, border: '3px solid #e0a100',
      borderRadius: '12px', boxShadow: '0 0 0 3px rgba(224,161,0,.28)', zIndex: 2147483647, pointerEvents: 'none',
    });
    if (n) {
      const s = document.createElement('span');
      s.textContent = String(n);
      Object.assign(s.style, {
        position: 'absolute', width: '26px', height: '26px', borderRadius: '50%',
        ...({ tl: { top: '-15px', left: '-15px' }, tr: { top: '-15px', right: '-15px' }, l: { top: 'calc(50% - 13px)', left: '-36px' },
          r: { top: 'calc(50% - 13px)', right: '-36px' }, b: { bottom: '-34px', left: 'calc(50% - 13px)' } })[side],
        background: '#e0a100', color: '#1f2433', font: '800 14px/26px Inter, Arial, sans-serif', textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      });
      d.appendChild(s);
    }
    document.body.appendChild(d);
  }, { b, n, side });
}
const unmark = (page) => page.evaluate(() => document.querySelectorAll('.__mark').forEach((e) => e.remove()));

/** Captura de la ventana (o de un recorte) tras dejar que la interfaz se asiente. */
async function shot(page, name, { wait = 700, clip, full = false, el } = {}) {
  await page.waitForTimeout(wait);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // Chromium en macOS pinta las fechas en formato de EE. UU. aunque el idioma sea español:
    // en la captura se muestran como texto dd/mm/aaaa y 24 h, como las vería un navegador en español.
    for (const i of document.querySelectorAll('input[type=date], input[type=datetime-local]')) {
      const m = i.value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
      if (!m) continue;
      i.type = 'text';
      i.value = `${m[3]}/${m[2]}/${m[1]}${m[4] ? `  ${m[4]}` : ''}`;
    }
  });
  const path = `${OUT}/${name}.png`;
  if (el) await page.locator(el).first().screenshot({ path, animations: 'disabled' });
  else await page.screenshot({ path, clip, fullPage: full, animations: 'disabled' });
  await unmark(page);
  console.log('✓', name);
}
const clipBelow = (page, y = 0, height) => ({ x: 0, y, width: page.viewportSize().width, height: height ?? page.viewportSize().height - y });
const go = async (page, url) => { await page.goto(url); await page.waitForLoadState('networkidle').catch(() => {}); };

// ---------- Datos de demostración ----------
const api = await browser.newContext({ baseURL: BASE });
const tours = await (await api.request.get('/api/public/tournaments')).json();
const T = tours.find((t) => t.status === 'IN_PROGRESS') ?? tours[0];
const cats = await (await api.request.get(`/api/public/tournaments/${T.id}/categories`)).json();
const catFinished = cats.find((c) => c.status === 'FINISHED' && c.format === 'SINGLE_ELIMINATION') ?? cats[0];
const catLive = cats.find((c) => c.status === 'IN_PROGRESS' && c.format !== 'ROUND_ROBIN') ?? catFinished;
const adminToken = (await (await api.request.post('/api/auth/login', { data: ADMIN })).json()).token;
const adminCats = await (await api.request.get(`/api/tournaments/${T.id}/categories`, { headers: { authorization: `Bearer ${adminToken}` } })).json().catch(() => []);
const catOpen = (Array.isArray(adminCats) ? adminCats : []).find((c) => c.status === 'OPEN' && (c._count?.registrations ?? c.registrations ?? 2) >= 2)
  ?? (Array.isArray(adminCats) ? adminCats.find((c) => c.status === 'OPEN') : null);
await api.close();
console.log('Torneo:', T.name);
const A = `/admin/torneos/${T.id}`;

/* ======================= Primeros pasos ======================= */
{
  const { ctx, page } = await context(DESK);
  await go(page, '/login');
  // La caja de credenciales de prueba solo existe en desarrollo; se quita para no mostrar contraseñas.
  await page.evaluate(() => [...document.querySelectorAll('p.label')].find((p) => p.textContent?.includes('Credenciales'))?.parentElement?.remove());
  await page.getByLabel('Correo electrónico').fill('organizacion@tuclub.com');
  await page.getByLabel('Contraseña').fill('contraseña-ejemplo');
  await mark(page, page.getByLabel('Correo electrónico'), 1, 'l');
  await mark(page, page.getByLabel('Contraseña'), 2, 'l');
  await mark(page, page.getByRole('button', { name: 'Entrar' }), 3, 'l');
  await shot(page, 'login');
  await go(page, '/');
  await mark(page, page.getByRole('link', { name: 'Entrar' }), 1, 'b');
  await mark(page, page.getByRole('button', { name: /^Tema/ }), 2, 'b');
  await shot(page, 'inicio-escritorio', { clip: clipBelow(page, 0, 620) });
  await ctx.close();
}
{
  const { ctx, page } = await context(DESK);
  await page.addInitScript(() => localStorage.setItem('zenkai-theme', 'dark'));
  await go(page, '/');
  await shot(page, 'inicio-oscuro', { clip: clipBelow(page, 0, 620) });
  await ctx.close();
}
{
  // Aviso de servidor despertando: se retrasan las respuestas de la API unos segundos.
  const { ctx, page } = await context(PHONE);
  await page.route('**/api/**', async (r) => { await new Promise((res) => setTimeout(res, 8000)); await r.continue().catch(() => {}); });
  await page.goto('/torneos');
  await page.getByTestId('server-wake-notice').waitFor({ timeout: 7000 }).catch(() => {});
  await shot(page, 'servidor-despertando', { wait: 1500, clip: clipBelow(page, 0, 330) });
  await ctx.close();
}

/* ======================= Administración (escritorio) ======================= */
{
  const { ctx, page } = await context(DESK, ADMIN);

  // Panel de inicio
  await go(page, '/admin');
  await shot(page, 'adm-inicio');

  // Deportes
  await go(page, '/admin/deportes');
  await mark(page, page.getByRole('button', { name: 'Nuevo deporte' }), 1);
  await shot(page, 'adm-deportes', { clip: clipBelow(page, 0, 420) });
  await page.setViewportSize({ width: 1440, height: 1700 }); // el formulario completo cabe sin scroll
  await page.getByRole('button', { name: /Editar/ }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor();
  await page.waitForTimeout(500);
  await mark(page, dlg.getByRole('button', { name: 'Añadir método' }), 1, 'r');
  await mark(page, dlg.getByRole('button', { name: 'Añadir cinturón' }), 2, 'r');
  await shot(page, 'adm-deporte-form', { el: '[role=dialog]' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });

  // Crear torneo
  await go(page, '/admin/torneos');
  await mark(page, page.getByRole('button', { name: 'Nuevo torneo' }), 1);
  await shot(page, 'adm-torneos', { clip: clipBelow(page, 0, 520) });
  await page.getByRole('button', { name: 'Nuevo torneo' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Nombre del torneo').fill('Copa Primavera 2027');
  await page.getByLabel('Sede').fill('Polideportivo Central');
  await page.getByLabel('Ciudad').fill('Valencia');
  await page.getByLabel('Deporte').selectOption({ index: 1 }).catch(() => {});
  await page.getByLabel('Fecha de inicio').fill('2027-04-17').catch(() => {});
  await page.getByLabel('Fecha de fin').fill('2027-04-18').catch(() => {});
  await page.waitForTimeout(600); // fin de la animación del diálogo antes de medir el botón
  await mark(page, page.getByRole('dialog').getByRole('button', { name: 'Crear torneo' }), 2);
  await shot(page, 'adm-torneo-nuevo', { el: '[role=dialog]' });
  await page.keyboard.press('Escape');

  // Resumen del torneo
  await go(page, A);
  await shot(page, 'adm-resumen');

  // Configuración: divisiones de peso y grupos de edad
  await go(page, `${A}/configuracion`);
  const div = page.getByRole('heading', { name: 'Divisiones de peso' });
  await div.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await shot(page, 'adm-configuracion');

  // Categorías
  await go(page, `${A}/categorias`);
  await mark(page, page.getByRole('button', { name: 'Generación asistida' }), 1);
  await mark(page, page.getByRole('button', { name: 'Nueva', exact: true }), 2);
  await shot(page, 'adm-categorias');
  await page.getByRole('button', { name: 'Generación asistida' }).click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'adm-categorias-asistida', { el: '[role=dialog]', wait: 900 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nueva', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'adm-categoria-nueva', { el: '[role=dialog]', wait: 900 });
  await page.keyboard.press('Escape');

  // Academias
  await go(page, '/admin/academias');
  await mark(page, page.getByRole('button', { name: 'Nueva academia' }), 1);
  await shot(page, 'adm-academias', { clip: clipBelow(page, 0, 560) });

  // Atletas e importación
  await go(page, '/admin/atletas');
  await mark(page, page.getByRole('button', { name: 'Nuevo atleta' }), 1, 'l');
  await mark(page, page.getByText('Importar', { exact: true }), 2, 'r');
  await shot(page, 'adm-atletas', { clip: clipBelow(page, 0, 560) });
  await page.locator('input[type=file]').setInputFiles({
    name: 'atletas.csv', mimeType: 'text/csv',
    buffer: Buffer.from('nombres,apellidos,documento,fechaNacimiento,genero,cinturon,academia,pesoDeclarado\nAna,García López,EJ-0001,1998-04-12,F,Azul,Kimura Team,63.5\nLuis,Pérez Ruiz,EJ-0002,1990-09-30,M,Blanca,Gracie Norte,78\nMarta,Santos Gil,EJ-0003,2001-01-22,F,Blanca,Dojo Central Madrid,57\n'),
  });
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(800);
  await mark(page, page.getByRole('dialog').getByRole('button', { name: /^Importar \d/ }), 1);
  await shot(page, 'adm-atletas-importar', { el: '[role=dialog]' });
  await page.keyboard.press('Escape');

  // Inscripciones. Todos los atletas de la demo ya están inscritos: se crea uno de ejemplo y se borra después.
  const auth = { authorization: `Bearer ${adminToken}` };
  const sample = (await (await page.request.get('/api/athletes', { headers: auth })).json()).find((a) => a.gender === 'F' && a.beltLevel?.name === 'Azul');
  const temp = await (await page.request.post('/api/athletes', { headers: auth, data: {
    firstName: 'Laura', lastName: 'Ejemplo Ruiz', document: `EJ-${Date.now().toString(36)}`, birthDate: '1998-05-14', gender: 'F',
    beltLevelId: sample?.beltLevelId ?? null, academyId: sample?.academyId ?? null } })).json();
  await go(page, `${A}/inscripciones`);
  await mark(page, page.getByRole('button', { name: 'Inscribir', exact: true }), 1, 'l');
  await shot(page, 'adm-inscripciones');
  await page.getByRole('button', { name: 'Inscribir', exact: true }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByLabel('Buscar atleta').pressSequentially('Laura', { delay: 30 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('dialog').getByText('Ejemplo Ruiz, Laura').first().click().catch(() => {});
  await page.getByRole('dialog').getByLabel('Peso declarado (kg)').fill('57').catch(() => {});
  await page.waitForTimeout(800);
  await mark(page, page.getByRole('dialog').getByRole('button', { name: 'Inscribir' }), 1, 'tl');
  await shot(page, 'adm-inscribir', { el: '[role=dialog]', wait: 600 });
  await page.keyboard.press('Escape');
  if (temp?.id) await page.request.delete(`/api/athletes/${temp.id}`, { headers: auth });

  // Pesaje
  await go(page, `${A}/pesaje`);
  await page.getByRole('button', { name: 'Sin pesar' }).click().catch(() => {});
  await mark(page, page.getByRole('button', { name: 'Sin pesar' }), 1, 'tl');
  await mark(page, page.getByRole('button', { name: 'Pesar', exact: true }), 2, 'tl');
  await shot(page, 'adm-pesaje', { clip: clipBelow(page, 0, 700) });
  await page.getByRole('button', { name: 'Pesar', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByLabel('Peso real (kg)').fill('63.4').catch(() => {});
  await mark(page, page.getByRole('button', { name: 'Registrar' }), 3, 'b');
  await shot(page, 'adm-pesaje-formulario', { clip: { x: 256, y: 380, width: 1184, height: 230 } });
  await page.keyboard.press('Escape');

  // Llaves: generar (categoría sin llave) y llave generada
  if (catOpen) {
    await go(page, `${A}/llaves?c=${catOpen.id}`);
    await mark(page, page.getByRole('button', { name: 'Generar por sorteo' }), 1, 'b');
    await mark(page, page.getByRole('button', { name: 'Con siembra' }), 2, 'b');
    await shot(page, 'adm-llaves-generar', { clip: clipBelow(page, 0, 640) });
  }
  await go(page, `${A}/llaves?c=${catLive.id}`);
  await page.getByRole('heading', { name: /Llave principal/i }).or(page.getByText('Llave principal')).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 260));
  await shot(page, 'adm-llaves', { wait: 1400 });

  // Corregir un resultado desde la llave (categoría finalizada)
  await go(page, `${A}/llaves?c=${catFinished.id}`);
  await page.waitForTimeout(1200);
  // Se lleva la llave arriba de la ventana y se recorta esa zona.
  await page.evaluate(() => {
    document.querySelector('[data-testid=bracket-viewport]')?.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -60);
  });
  await page.waitForTimeout(400);
  const fin = page.locator('[data-testid=bracket-content] button.card:not(.border-dashed)').last();
  await mark(page, fin, 1, 'r');
  const vp = await page.locator('[data-testid=bracket-viewport]').boundingBox();
  const top = vp.y + (await page.evaluate(() => scrollY)) - 16; // coordenadas del documento (captura de página completa)
  await shot(page, 'adm-corregir-llave', { wait: 300, full: true, clip: { x: 256, y: top, width: 1184, height: Math.min(vp.height + 32, 520) } });
  await fin.click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Motivo de la corrección').fill('Error al anotar la esquina ganadora').catch(() => {});
  await shot(page, 'adm-corregir-modal', { el: '[role=dialog]', wait: 900 });
  await page.keyboard.press('Escape');

  // Tatamis, programación y mesas
  await go(page, `${A}/tatamis`);
  await mark(page, page.getByRole('button', { name: 'Añadir' }), 1, 'r');
  await mark(page, page.getByRole('button', { name: 'Asignar mesa' }).first(), 2, 'r');
  await mark(page, page.getByRole('button', { name: 'Guardar programación' }), 3, 'l');
  await shot(page, 'adm-tatamis', { full: true, clip: { x: 256, y: 270, width: 1184, height: 760 } });
  await page.getByRole('button', { name: 'Asignar mesa' }).first().click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'adm-asignar-mesa', { el: '[role=dialog]', wait: 800 });
  await page.keyboard.press('Escape');

  // Usuarios de mesa
  await go(page, '/admin/usuarios');
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Nombre').fill('Mesa Tatami 4').catch(() => {});
  await page.getByLabel('Correo').fill('mesa4@tuclub.com').catch(() => {});
  await page.getByLabel('Contraseña').fill('contraseña-ejemplo').catch(() => {});
  await page.getByLabel('Rol').selectOption('TABLE').catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole('dialog').getByLabel('Tatami 3').check().catch(() => {});
  await shot(page, 'adm-usuario-nuevo', { el: '[role=dialog]' });
  await page.keyboard.press('Escape');

  // Exportar
  await go(page, `${A}/exportar`);
  await shot(page, 'adm-exportar', { clip: clipBelow(page, 0, 720) });

  // Medallero (vista pública en escritorio)
  await go(page, `/t/${T.id}?tab=medallero`);
  await shot(page, 'adm-medallero', { wait: 1200 });
  await ctx.close();
}

/* ======================= Mesa de control (tablet 768 px) ======================= */
{
  // Mesa del Tatami 2: sin combate en curso → botón Iniciar
  const { ctx, page, token } = await context(TABLET, MESA2);
  const me = await (await page.request.get('/api/auth/me', { headers: { authorization: `Bearer ${token}` } })).json();
  await go(page, '/mesa');
  await shot(page, 'mesa-tatamis', { clip: clipBelow(page, 0, 330) });
  await go(page, `/mesa/${me.mats[0].id}`);
  await mark(page, page.getByRole('button', { name: 'Iniciar' }).first(), 1, 'b');
  await shot(page, 'mesa-iniciar', { clip: clipBelow(page, 0, 700) });
  await ctx.close();
}
{
  // Mesa del Tatami 1: combate en curso
  const { ctx, page, token } = await context(TABLET, MESA);
  const me = await (await page.request.get('/api/auth/me', { headers: { authorization: `Bearer ${token}` } })).json();
  await go(page, `/mesa/${me.mats[0].id}`);
  await mark(page, page.getByRole('button', { name: 'Registrar ganador' }).first(), 1, 'tl');
  await shot(page, 'mesa-consola', { clip: clipBelow(page, 0, 700) });
  await page.getByRole('button', { name: 'Registrar ganador' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor();
  await page.waitForTimeout(600);
  await mark(page, dlg.getByRole('button', { name: /Rojo/ }).first(), 1, 'tl');
  await mark(page, dlg.getByRole('button', { name: /Azul/ }).first(), 1, 'tr');
  await shot(page, 'mesa-ganador', { el: '[role=dialog]' });
  // Paso 2: elegir el método (se elige la esquina roja; no se pulsa ningún método, así no se guarda nada)
  await dlg.getByRole('button', { name: /Rojo/ }).first().click();
  await page.waitForTimeout(600);
  await mark(page, dlg.getByRole('button', { name: /Sumisión/ }).first(), 2, 'tl');
  await shot(page, 'mesa-metodo', { el: '[role=dialog]' });
  await page.keyboard.press('Escape');
  // Corregir un resultado finalizado
  await page.getByRole('button', { name: 'Finalizados' }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('done-h')?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -90); });
  const done = page.locator('#done-h').locator('xpath=..').getByRole('button').first();
  await mark(page, done, 1, 'tl');
  await shot(page, 'mesa-finalizados', { clip: clipBelow(page, 0, 560) });
  await done.click().catch(() => {});
  await page.getByRole('dialog').waitFor().catch(() => {});
  await page.getByLabel('Motivo de la corrección').fill('El árbitro corrigió la decisión').catch(() => {});
  await mark(page, page.getByLabel('Motivo de la corrección'), 1, 'tl');
  await shot(page, 'mesa-corregir', { el: '[role=dialog]', wait: 800 });
  await page.keyboard.press('Escape');
  await ctx.close();
}

/* ======================= Vista pública (móvil 390 px) ======================= */
{
  const { ctx, page } = await context(PHONE);
  await go(page, '/');
  await shot(page, 'pub-inicio');
  await go(page, '/torneos');
  await shot(page, 'pub-torneos');
  await go(page, `/t/${T.id}`);
  await shot(page, 'pub-torneo');
  await go(page, `/t/${T.id}/c/${catLive.id}`);
  await page.waitForTimeout(1200);
  const h = page.getByRole('heading', { name: 'Llave', exact: true });
  await h.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -70));
  await shot(page, 'pub-llave');
  await go(page, `/t/${T.id}/c/${catFinished.id}`);
  await page.waitForTimeout(1000);
  await shot(page, 'pub-podio');
  await go(page, `/t/${T.id}?tab=tatamis`);
  await shot(page, 'pub-tatamis', { wait: 1000 });
  await go(page, `/t/${T.id}?tab=medallero`);
  await shot(page, 'pub-medallero', { wait: 1000 });
  await ctx.close();
}
{
  const { ctx, page } = await context(TV);
  await go(page, `/t/${T.id}/tv`);
  await shot(page, 'pub-tv', { wait: 1800 });
  await ctx.close();
}
{
  // Para la sección de dispositivos: la misma app en tablet
  const { ctx, page } = await context(TABLET);
  await go(page, `/t/${T.id}`);
  await shot(page, 'tablet-torneo');
  await ctx.close();
}
await browser.close();
