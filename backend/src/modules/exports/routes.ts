import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma.js';
import { idParam } from '../../lib/schemas.js';
import { getBracket, matchInclude } from '../brackets/service.js';
import { tournamentMedals } from '../medals/service.js';
import { GENDER_LABEL } from '../categories/service.js';
import { assertPublicCategory, assertPublicTournament } from '../../lib/visibility.js';

const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIMINATION: 'Eliminación simple', SINGLE_ELIMINATION_BRONZE: 'Eliminación simple + bronce', DOUBLE_ELIMINATION: 'Eliminación doble', ROUND_ROBIN: 'Todos contra todos',
};
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', FINISHED: 'Finalizado', BYE: 'BYE' };
const WEIGH_LABEL: Record<string, string> = { PENDING: 'Sin pesar', OK: 'Apto', OVERWEIGHT: 'Sobrepeso', UNDERWEIGHT: 'Bajo peso', DISQUALIFIED: 'Descalificado' };
const fullName = (a: { firstName: string; lastName: string } | null | undefined) => (a ? `${a.firstName} ${a.lastName}` : '—');
const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—');
const fmtDateTime = (d: Date | null | undefined) => (d ? d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/* ------------------------------------------------------------------ PDF helpers */
const INK = '#1f2433';
const ACCENT = '#c8373b';
const MUTED = '#6b7280';

function pdfDoc(title: string, subtitle: string, landscape = false) {
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 40, info: { Title: title, Author: 'Zenkai Dojo' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  header(doc, title, subtitle);
  return { doc, done };
}
function header(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const w = doc.page.width - 80;
  doc.save().rect(40, 40, 6, 34).fill(ACCENT).restore();
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('ZENKAI DOJO', 54, 40);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(subtitle, 54, 60, { width: w - 14 });
  doc.moveDown(0.5);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(title, 40, 86, { width: w });
  doc.moveTo(40, 106).lineTo(40 + w, 106).lineWidth(0.8).strokeColor('#d6d3cd').stroke();
  doc.y = 116;
}
function table(doc: PDFKit.PDFDocument, cols: { label: string; width: number; align?: 'left' | 'right' | 'center' }[], rows: string[][], opts: { zebra?: boolean } = {}) {
  const x0 = 40;
  const rowH = 18;
  const drawHead = () => {
    let x = x0;
    const y = doc.y;
    doc.save().rect(x0, y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#eceae4').restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK);
    for (const c of cols) {
      doc.text(c.label, x + 4, y + 5, { width: c.width - 8, align: c.align ?? 'left', lineBreak: false });
      x += c.width;
    }
    doc.y = y + rowH;
  };
  drawHead();
  doc.font('Helvetica').fontSize(8.5);
  rows.forEach((r, i) => {
    if (doc.y + rowH > doc.page.height - 50) {
      doc.addPage();
      doc.y = 40;
      drawHead();
      doc.font('Helvetica').fontSize(8.5);
    }
    if (opts.zebra !== false && i % 2 === 1) doc.save().rect(x0, doc.y, cols.reduce((s, c) => s + c.width, 0), rowH).fill('#f7f6f2').restore();
    let x = x0;
    const y = doc.y;
    cols.forEach((c, j) => {
      doc.fillColor(INK).text(r[j] ?? '', x + 4, y + 5, { width: c.width - 8, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
      x += c.width;
    });
    doc.y = y + rowH;
  });
  doc.moveDown(1);
}

function send(reply: { header: (k: string, v: string) => unknown; send: (b: Buffer) => unknown }, buf: Buffer, filename: string, mime: string) {
  reply.header('Content-Type', mime);
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(buf);
}
const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60);

/** Dibuja una llave de eliminación como gráfico de columnas por ronda. */
function drawBracket(doc: PDFKit.PDFDocument, matches: Awaited<ReturnType<typeof getBracket>>['matches'], side: string, title: string) {
  const ms = matches.filter((m) => m.side === side);
  if (!ms.length) return;
  const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
  const colW = Math.min(150, (doc.page.width - 80) / rounds.length);
  const boxH = 30;
  const firstCount = ms.filter((m) => m.round === rounds[0]).length;
  const slotH = boxH + 12;
  const totalH = firstCount * slotH;
  if (doc.y + totalH + 30 > doc.page.height - 40) {
    doc.addPage();
    doc.y = 40;
  }
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(title, 40, doc.y);
  const top = doc.y + 6;
  const centers = new Map<string, { x: number; y: number }>();
  rounds.forEach((r, ri) => {
    const list = ms.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
    const count = list.length;
    const pitch = totalH / count;
    list.forEach((m, i) => {
      const x = 40 + ri * colW;
      const yC = top + pitch * i + pitch / 2;
      const y = yC - boxH / 2;
      const w = colW - 16;
      const winner = m.winnerId;
      doc.save().roundedRect(x, y, w, boxH, 3).lineWidth(0.7).strokeColor('#b8b4ab').stroke().restore();
      doc.moveTo(x, y + boxH / 2).lineTo(x + w, y + boxH / 2).lineWidth(0.4).strokeColor('#d6d3cd').stroke();
      const line = (reg: typeof m.red, yy: number, isW: boolean) => {
        doc.font(isW ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(isW ? ACCENT : INK);
        const name = reg ? `${reg.athlete.firstName} ${reg.athlete.lastName}` : m.status === 'BYE' ? 'BYE' : '—';
        if (isW) doc.save().rect(x + 4, yy + 4.5, 3, 7).fill('#c9a227').restore();
        doc.text(name, x + (isW ? 11 : 4), yy + 3, { width: w - (isW ? 15 : 8), lineBreak: false, ellipsis: true });
      };
      line(m.red, y, !!winner && winner === m.redId);
      line(m.blue, y + boxH / 2, !!winner && winner === m.blueId);
      if (m.victoryMethod && winner) {
        doc.font('Helvetica').fontSize(6).fillColor(MUTED).text(m.victoryMethod.name, x, y + boxH + 1, { width: w, align: 'right', lineBreak: false });
      }
      centers.set(m.id, { x: x + w, y: yC });
      // conector al siguiente
      if (m.nextMatchId && ri < rounds.length - 1) {
        const nx = 40 + (ri + 1) * colW;
        const nextList = ms.filter((mm) => mm.round === rounds[ri + 1]).sort((a, b) => a.position - b.position);
        const nIdx = nextList.findIndex((mm) => mm.id === m.nextMatchId);
        if (nIdx >= 0) {
          const nPitch = totalH / nextList.length;
          const nyC = top + nPitch * nIdx + nPitch / 2;
          doc.moveTo(x + w, yC).lineTo(x + w + 8, yC).lineTo(x + w + 8, nyC).lineTo(nx, nyC).lineWidth(0.6).strokeColor('#9c988f').stroke();
        }
      }
    });
  });
  doc.y = top + totalH + 16;
}

export const exportRoutes: FastifyPluginAsyncZod = async (app) => {
  // Los PDF son públicos (solo datos que ya muestra la vista pública). El Excel completo requiere sesión.
  app.addHook('preHandler', app.optionalAuth);

  /* ------------------------------------------------------------------ PDF: llave de una categoría */
  app.get('/categories/:id/bracket.pdf', { schema: { tags: ['Exportación'], security: [], params: idParam } }, async (req, reply) => {
    await assertPublicCategory(req.params.id, req.user ?? null);
    const b = await getBracket(req.params.id);
    const { doc, done } = pdfDoc(b.category.name, `${b.category.tournament.name} · ${FORMAT_LABEL[b.category.format]} · ${b.category.registrations.length} atletas`, true);
    if (b.category.format === 'ROUND_ROBIN') {
      const regById = new Map(b.category.registrations.map((r) => [r.id, r]));
      table(doc, [{ label: '#', width: 30 }, { label: 'Atleta', width: 220 }, { label: 'Academia', width: 180 }, { label: 'PJ', width: 50, align: 'right' }, { label: 'V', width: 50, align: 'right' }, { label: 'D', width: 50, align: 'right' }, { label: 'Pts', width: 60, align: 'right' }],
        (b.standings ?? []).map((s) => { const r = regById.get(s.participantId); return [String(s.rank), fullName(r?.athlete), r?.athlete.academy?.name ?? '—', String(s.played), String(s.wins), String(s.losses), String(s.methodPoints)]; }));
      table(doc, [{ label: 'Ronda', width: 60 }, { label: 'Rojo', width: 220 }, { label: 'Azul', width: 220 }, { label: 'Ganador', width: 180 }, { label: 'Método', width: 100 }],
        b.matches.map((m) => [String(m.round), fullName(m.red?.athlete), fullName(m.blue?.athlete), m.winnerId ? fullName((m.winnerId === m.redId ? m.red : m.blue)?.athlete) : '—', m.victoryMethod?.name ?? '—']));
    } else {
      drawBracket(doc, b.matches, 'WINNERS', b.category.format === 'DOUBLE_ELIMINATION' ? 'Llave de ganadores' : 'Llave principal');
      drawBracket(doc, b.matches, 'LOSERS', 'Repechaje');
      drawBracket(doc, b.matches, 'GRAND_FINAL', 'Gran final');
      drawBracket(doc, b.matches, 'THIRD_PLACE', 'Tercer lugar');
    }
    if (b.podium.complete) {
      const regById = new Map(b.category.registrations.map((r) => [r.id, r]));
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Podio', 40, doc.y);
      doc.font('Helvetica').fontSize(9.5);
      doc.text(`Oro: ${fullName(regById.get(b.podium.gold ?? '')?.athlete)}`, 40, doc.y + 4);
      doc.text(`Plata: ${fullName(regById.get(b.podium.silver ?? '')?.athlete)}`);
      for (const br of b.podium.bronze) doc.text(`Bronce: ${fullName(regById.get(br)?.athlete)}`);
    }
    doc.end();
    return send(reply, await done, `llave_${safe(b.category.name)}.pdf`, PDF);
  });

  /* ------------------------------------------------------------------ PDF: participantes por categoría */
  app.get('/tournaments/:id/participants.pdf', { schema: { tags: ['Exportación'], security: [], params: idParam } }, async (req, reply) => {
    await assertPublicTournament(req.params.id, req.user ?? null);
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const cats = await prisma.category.findMany({ where: { tournamentId: t.id }, include: { registrations: { include: { athlete: { include: { academy: true, beltLevel: true } } }, orderBy: { athlete: { lastName: 'asc' } } } }, orderBy: [{ order: 'asc' }, { name: 'asc' }] });
    const { doc, done } = pdfDoc('Lista de participantes por categoría', `${t.name} · ${t.venue} · ${fmtDate(t.startDate)}`);
    for (const c of cats) {
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 40; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT).text(`${c.name}  (${c.registrations.length})`, 40, doc.y);
      doc.y += 4;
      table(doc, [{ label: 'Atleta', width: 190 }, { label: 'Academia', width: 150 }, { label: 'Cinturón', width: 70 }, { label: 'Peso', width: 50, align: 'right' }, { label: 'Pesaje', width: 55 }],
        c.registrations.map((r) => [fullName(r.athlete), r.athlete.academy?.name ?? '—', r.athlete.beltLevel?.name ?? '—', r.weightKg != null ? `${r.weightKg} kg` : '—', WEIGH_LABEL[r.weighInStatus]]));
    }
    doc.end();
    return send(reply, await done, `participantes_${safe(t.name)}.pdf`, PDF);
  });

  /* ------------------------------------------------------------------ PDF: horarios por tatami */
  app.get('/tournaments/:id/schedule.pdf', { schema: { tags: ['Exportación'], security: [], params: idParam } }, async (req, reply) => {
    await assertPublicTournament(req.params.id, req.user ?? null);
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const mats = await prisma.mat.findMany({ where: { tournamentId: t.id }, include: { categories: { orderBy: [{ scheduledAt: 'asc' }, { order: 'asc' }], include: { _count: { select: { matches: true, registrations: true } } } } }, orderBy: { order: 'asc' } });
    const { doc, done } = pdfDoc('Programación por tatami', `${t.name} · ${t.venue}`);
    for (const m of mats) {
      if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 40; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT).text(m.name, 40, doc.y);
      doc.y += 4;
      table(doc, [{ label: 'Hora', width: 90 }, { label: 'Categoría', width: 280 }, { label: 'Atletas', width: 70, align: 'right' }, { label: 'Combates', width: 75, align: 'right' }],
        m.categories.map((c) => [c.scheduledAt ? c.scheduledAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '—', c.name, String(c._count.registrations), String(c._count.matches)]));
    }
    doc.end();
    return send(reply, await done, `horarios_${safe(t.name)}.pdf`, PDF);
  });

  /* ------------------------------------------------------------------ PDF: resultados */
  app.get('/tournaments/:id/results.pdf', { schema: { tags: ['Exportación'], security: [], params: idParam } }, async (req, reply) => {
    await assertPublicTournament(req.params.id, req.user ?? null);
    const med = await tournamentMedals(req.params.id);
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const { doc, done } = pdfDoc('Resultados y medallero', `${t.name} · ${t.venue} · ${fmtDate(t.startDate)}`);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT).text('Medallero por academia', 40, doc.y);
    doc.y += 4;
    table(doc, [{ label: '#', width: 30 }, { label: 'Academia', width: 250 }, { label: 'Oro', width: 55, align: 'right' }, { label: 'Plata', width: 55, align: 'right' }, { label: 'Bronce', width: 60, align: 'right' }, { label: 'Puntos', width: 65, align: 'right' }],
      med.academies.map((a) => [String(a.rank), a.academyName, String(a.gold), String(a.silver), String(a.bronze), String(a.points)]));
    doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT).text('Podios por categoría', 40, doc.y);
    doc.y += 4;
    table(doc, [{ label: 'Categoría', width: 190 }, { label: 'Oro', width: 115 }, { label: 'Plata', width: 115 }, { label: 'Bronce', width: 95 }],
      med.byCategory.filter((c) => c.complete).map((c) => [c.category.name, fullName(c.gold?.athlete), fullName(c.silver?.athlete), c.bronze.map((b) => fullName(b.athlete)).join(' / ') || '—']));
    doc.end();
    return send(reply, await done, `resultados_${safe(t.name)}.pdf`, PDF);
  });

  /* ------------------------------------------------------------------ Excel: libro completo */
  // Contiene documento, correo y teléfono de los atletas: requiere sesión
  app.get('/tournaments/:id/export.xlsx', { preHandler: [app.authenticate], schema: { tags: ['Exportación'], params: idParam, querystring: z.object({ sheets: z.string().optional() }) } }, async (req, reply) => {
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const wanted = new Set((req.query.sheets ?? 'participantes,categorias,resultados,medallero').split(','));
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zenkai Dojo';
    const style = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2433' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.columns.forEach((c) => { c.width = Math.max(12, Math.min(40, (c.header?.toString().length ?? 10) + 6)); });
    };
    if (wanted.has('participantes')) {
      const regs = await prisma.registration.findMany({ where: { tournamentId: t.id }, include: { athlete: { include: { academy: true, beltLevel: true } }, category: true }, orderBy: { athlete: { lastName: 'asc' } } });
      const ws = wb.addWorksheet('Participantes');
      ws.columns = [
        { header: 'Apellidos', key: 'lastName' }, { header: 'Nombres', key: 'firstName' }, { header: 'Documento', key: 'document' }, { header: 'Fecha nacimiento', key: 'birth' }, { header: 'Género', key: 'gender' },
        { header: 'Cinturón', key: 'belt' }, { header: 'Academia', key: 'academy' }, { header: 'Categoría', key: 'category' }, { header: 'Peso declarado', key: 'declared' }, { header: 'Peso real', key: 'weight' }, { header: 'Pesaje', key: 'weigh' }, { header: 'Email', key: 'email' }, { header: 'Teléfono', key: 'phone' },
      ];
      for (const r of regs) ws.addRow({ lastName: r.athlete.lastName, firstName: r.athlete.firstName, document: r.athlete.document, birth: r.athlete.birthDate.toISOString().slice(0, 10), gender: GENDER_LABEL[r.athlete.gender], belt: r.athlete.beltLevel?.name ?? '', academy: r.athlete.academy?.name ?? '', category: r.category?.name ?? '', declared: r.declaredWeight ?? '', weight: r.weightKg ?? '', weigh: WEIGH_LABEL[r.weighInStatus], email: r.athlete.email ?? '', phone: r.athlete.phone ?? '' });
      style(ws);
    }
    if (wanted.has('categorias')) {
      const cats = await prisma.category.findMany({ where: { tournamentId: t.id }, include: { weightDivision: true, ageGroup: true, beltLevel: true, mat: true, _count: { select: { registrations: true, matches: true } } }, orderBy: [{ order: 'asc' }, { name: 'asc' }] });
      const ws = wb.addWorksheet('Categorías');
      ws.columns = [{ header: 'Categoría', key: 'name' }, { header: 'Género', key: 'gender' }, { header: 'Edad', key: 'age' }, { header: 'Cinturón', key: 'belt' }, { header: 'División', key: 'div' }, { header: 'Mín kg', key: 'min' }, { header: 'Máx kg', key: 'max' }, { header: 'Formato', key: 'format' }, { header: 'Estado', key: 'status' }, { header: 'Tatami', key: 'mat' }, { header: 'Inscritos', key: 'regs' }, { header: 'Combates', key: 'matches' }];
      for (const c of cats) ws.addRow({ name: c.name, gender: GENDER_LABEL[c.gender], age: c.ageGroup?.name ?? '', belt: c.beltLevel?.name ?? '', div: c.weightDivision?.name ?? '', min: c.weightDivision?.minKg ?? '', max: c.weightDivision?.maxKg ?? '', format: FORMAT_LABEL[c.format], status: c.status, mat: c.mat?.name ?? '', regs: c._count.registrations, matches: c._count.matches });
      style(ws);
    }
    if (wanted.has('resultados')) {
      const ms = await prisma.match.findMany({ where: { category: { tournamentId: t.id }, status: { not: 'BYE' } }, include: matchInclude, orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }] });
      const ws = wb.addWorksheet('Resultados');
      ws.columns = [{ header: 'Categoría', key: 'cat' }, { header: 'Fase', key: 'side' }, { header: 'Ronda', key: 'round' }, { header: 'Etiqueta', key: 'label' }, { header: 'Tatami', key: 'mat' }, { header: 'Orden', key: 'ord' }, { header: 'Rojo', key: 'red' }, { header: 'Academia rojo', key: 'redA' }, { header: 'Azul', key: 'blue' }, { header: 'Academia azul', key: 'blueA' }, { header: 'Ganador', key: 'winner' }, { header: 'Método', key: 'method' }, { header: 'Estado', key: 'status' }, { header: 'Finalizado', key: 'fin' }];
      for (const m of ms) ws.addRow({ cat: m.category.name, side: m.side, round: m.round, label: m.label ?? '', mat: m.mat?.name ?? '', ord: m.matOrder ?? '', red: fullName(m.red?.athlete), redA: m.red?.athlete.academy?.name ?? '', blue: fullName(m.blue?.athlete), blueA: m.blue?.athlete.academy?.name ?? '', winner: m.winnerId ? fullName((m.winnerId === m.redId ? m.red : m.blue)?.athlete) : '', method: m.victoryMethod?.name ?? '', status: STATUS_LABEL[m.status], fin: m.finishedAt ? fmtDateTime(m.finishedAt) : '' });
      style(ws);
    }
    if (wanted.has('medallero')) {
      const med = await tournamentMedals(t.id);
      const ws = wb.addWorksheet('Medallero');
      ws.columns = [{ header: 'Posición', key: 'rank' }, { header: 'Academia', key: 'name' }, { header: 'Oro', key: 'gold' }, { header: 'Plata', key: 'silver' }, { header: 'Bronce', key: 'bronze' }, { header: 'Puntos', key: 'points' }];
      for (const a of med.academies) ws.addRow({ rank: a.rank, name: a.academyName, gold: a.gold, silver: a.silver, bronze: a.bronze, points: a.points });
      style(ws);
      const ws2 = wb.addWorksheet('Podios');
      ws2.columns = [{ header: 'Categoría', key: 'cat' }, { header: 'Oro', key: 'gold' }, { header: 'Academia oro', key: 'goldA' }, { header: 'Plata', key: 'silver' }, { header: 'Academia plata', key: 'silverA' }, { header: 'Bronce', key: 'bronze' }, { header: 'Bronce 2', key: 'bronze2' }];
      for (const c of med.byCategory.filter((x) => x.complete)) ws2.addRow({ cat: c.category.name, gold: fullName(c.gold?.athlete), goldA: c.gold?.athlete.academy?.name ?? '', silver: fullName(c.silver?.athlete), silverA: c.silver?.athlete.academy?.name ?? '', bronze: c.bronze[0] ? fullName(c.bronze[0].athlete) : '', bronze2: c.bronze[1] ? fullName(c.bronze[1].athlete) : '' });
      style(ws2);
    }
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return send(reply, buf, `zenkai_${safe(t.name)}.xlsx`, XLSX);
  });

  /** Plantilla de importación de atletas */
  app.get('/athletes/template.xlsx', { schema: { tags: ['Exportación'], security: [] } }, async (_req, reply) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Atletas');
    ws.columns = [{ header: 'nombres', key: 'a' }, { header: 'apellidos', key: 'b' }, { header: 'documento', key: 'c' }, { header: 'fechaNacimiento', key: 'd' }, { header: 'genero', key: 'e' }, { header: 'cinturon', key: 'f' }, { header: 'academia', key: 'g' }, { header: 'pesoDeclarado', key: 'h' }, { header: 'email', key: 'i' }, { header: 'telefono', key: 'j' }];
    ws.addRow({ a: 'Ana', b: 'García', c: '12345678', d: '1995-04-12', e: 'F', f: 'Azul', g: 'Dojo Central', h: 61.5, i: 'ana@example.com', j: '+34 600 000 000' });
    ws.getRow(1).font = { bold: true };
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return send(reply, buf, 'plantilla_atletas.xlsx', XLSX);
  });
};
