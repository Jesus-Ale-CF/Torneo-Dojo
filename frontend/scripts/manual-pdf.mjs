/**
 * Convierte docs/manual/manual.html en docs/manual/Manual_Torneo_Dojo.pdf (Chromium de Playwright).
 *   npm run manual:pdf
 * Dos pasadas: la primera genera el PDF y lee en qué página cae cada destino del índice (#c1, #s3-2…);
 * la segunda escribe esos números en el índice y genera el PDF definitivo.
 */
import { chromium } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const html = resolve(root, 'docs/manual/manual.html');
const out = resolve(root, 'docs/manual/Manual_Torneo_Dojo.pdf');

const PDF_OPTIONS = {
  format: 'A4', printBackground: true, preferCSSPageSize: true, outline: true, tagged: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#5c6270;padding:0 16mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
    <span>Torneo Dojo · Manual de usuario</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
};

/** Página (1…n) de cada destino con nombre del PDF. */
async function destinationPages(buffer, ids) {
  const task = getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const doc = await task.promise;
  const pages = {};
  for (const id of ids) {
    const dest = await doc.getDestination(id);
    if (dest) pages[id] = (await doc.getPageIndex(dest[0])) + 1;
  }
  const total = doc.numPages;
  await task.destroy();
  return { pages, total };
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
});
await page.emulateMedia({ media: 'print' });

const ids = await page.$$eval('.toc .pg[data-for]', (els) => els.map((e) => e.dataset.for));
const first = await destinationPages(await page.pdf(PDF_OPTIONS), ids);
const missing = ids.filter((id) => !first.pages[id]);
if (missing.length) throw new Error(`Sin página en el PDF para: ${missing.join(', ')}`);

await page.$$eval('.toc .pg[data-for]', (els, pages) => els.forEach((e) => { e.textContent = String(pages[e.dataset.for]); }), first.pages);
const pdf = await page.pdf(PDF_OPTIONS);
const second = await destinationPages(pdf, ids);
const moved = ids.filter((id) => second.pages[id] !== first.pages[id]);
if (moved.length) throw new Error(`El índice movió páginas (${moved.join(', ')}); vuelve a ejecutar el script`);

writeFileSync(out, pdf);
await browser.close();
console.log(`PDF generado: ${out} (${second.total} páginas, ${(pdf.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(ids.map((id) => `  ${id.padEnd(5)} → p. ${second.pages[id]}`).join('\n'));
