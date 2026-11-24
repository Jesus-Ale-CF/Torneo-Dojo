/** Convierte docs/manual/manual.html en docs/Manual_de_usuario_Zenkai_Dojo.pdf (Chromium de Playwright). */
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = resolve(root, 'docs/manual/manual.html');
const out = resolve(root, 'docs/Manual_de_usuario_Zenkai_Dojo.pdf');
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:8px;color:#5c6270;padding:0 16mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif"><span>Zenkai Dojo · Manual de usuario</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>' });
await b.close();
console.log('PDF generado:', out);
