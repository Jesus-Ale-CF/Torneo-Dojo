import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { dateString, genderEnum, idParam, okResponse } from '../../lib/schemas.js';
import { optionalText } from '../../lib/zod-es.js';
import { findMatchingCategories } from '../categories/service.js';

const beltOut = z.object({ id: z.string(), name: z.string(), color: z.string(), secondary: z.string().nullable() }).nullable();
export const athleteOut = z.object({
  id: z.string(), firstName: z.string(), lastName: z.string(), document: z.string(), birthDate: z.date(), gender: genderEnum,
  beltLevelId: z.string().nullable(), beltLevel: beltOut, academyId: z.string().nullable(), academy: z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable() }).nullable(),
  email: z.string().nullable(), phone: z.string().nullable(), _count: z.object({ registrations: z.number() }).optional(),
});
const athleteBody = z.object({
  firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(80), document: z.string().trim().min(3).max(30), birthDate: dateString, gender: genderEnum,
  beltLevelId: z.string().uuid().nullable().optional(), academyId: z.string().uuid().nullable().optional(), email: z.union([z.string().trim().email(), z.literal('')]).nullish().transform((v) => (v ? v : v === '' ? null : v)), phone: optionalText(30),
});
const include = { beltLevel: true, academy: { select: { id: true, name: true, abbreviation: true } }, _count: { select: { registrations: true } } };

/** Fila de importación: cabeceras flexibles en español/inglés */
const importRow = z.object({
  nombres: z.string().min(1), apellidos: z.string().min(1), documento: z.string().min(3), fechaNacimiento: z.string(), genero: z.string(),
  cinturon: z.string().optional().nullable(), academia: z.string().optional().nullable(), email: z.string().optional().nullable(), telefono: z.string().optional().nullable(),
  pesoDeclarado: z.union([z.number(), z.string()]).optional().nullable(),
});

function parseDate(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseGender(s: string): 'M' | 'F' | 'X' | null {
  const v = s.trim().toUpperCase();
  if (['M', 'MASCULINO', 'HOMBRE', 'MALE'].includes(v)) return 'M';
  if (['F', 'FEMENINO', 'MUJER', 'FEMALE'].includes(v)) return 'F';
  if (['X', 'MIXTO', 'OTRO'].includes(v)) return 'X';
  return null;
}

export const athleteRoutes: FastifyPluginAsyncZod = async (app) => {
  const admin = [app.requireRole('ADMIN')];

  app.get('/', { preHandler: admin, schema: { tags: ['Atletas'], querystring: z.object({ q: z.string().optional(), academyId: z.string().uuid().optional() }), response: { 200: z.array(athleteOut) } } }, async (req) =>
    prisma.athlete.findMany({
      where: {
        ...(req.query.academyId ? { academyId: req.query.academyId } : {}),
        ...(req.query.q ? { OR: [{ firstName: { contains: req.query.q, mode: 'insensitive' } }, { lastName: { contains: req.query.q, mode: 'insensitive' } }, { document: { contains: req.query.q } }] } : {}),
      },
      include, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 500,
    }));

  app.get('/:id', { preHandler: admin, schema: { tags: ['Atletas'], params: idParam, response: { 200: athleteOut } } }, async (req) =>
    prisma.athlete.findUniqueOrThrow({ where: { id: req.params.id }, include }));

  app.post('/', { preHandler: admin, schema: { tags: ['Atletas'], body: athleteBody, response: { 201: athleteOut } } }, async (req, reply) =>
    reply.status(201).send(await prisma.athlete.create({ data: { ...req.body, email: req.body.email || null, birthDate: new Date(req.body.birthDate) }, include })));

  app.patch('/:id', { preHandler: admin, schema: { tags: ['Atletas'], params: idParam, body: athleteBody.partial(), response: { 200: athleteOut } } }, async (req) => {
    const { birthDate, email, ...rest } = req.body;
    return prisma.athlete.update({ where: { id: req.params.id }, data: { ...rest, ...(email !== undefined ? { email: email || null } : {}), ...(birthDate ? { birthDate: new Date(birthDate) } : {}) }, include });
  });

  app.delete('/:id', { preHandler: admin, schema: { tags: ['Atletas'], params: idParam, response: { 200: okResponse } } }, async (req) => {
    await prisma.athlete.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  /**
   * Importación masiva (el frontend convierte Excel/CSV a JSON). Crea academias faltantes,
   * hace upsert por documento y, si se indica torneo, inscribe y asigna categoría automáticamente.
   */
  app.post(
    '/import',
    {
      preHandler: admin,
      schema: {
        tags: ['Atletas'],
        body: z.object({ rows: z.array(importRow).min(1).max(2000), sportId: z.string().uuid(), tournamentId: z.string().uuid().optional() }),
        response: { 200: z.object({ created: z.number(), updated: z.number(), registered: z.number(), assigned: z.number(), errors: z.array(z.object({ row: z.number(), message: z.string() })) }) },
      },
    },
    async (req) => {
      const { rows, sportId, tournamentId } = req.body;
      const belts = await prisma.beltLevel.findMany({ where: { sportId } });
      const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const beltByName = new Map(belts.map((b) => [norm(b.name), b.id]));
      const academies = new Map((await prisma.academy.findMany()).map((a) => [norm(a.name), a.id]));
      const result = { created: 0, updated: 0, registered: 0, assigned: 0, errors: [] as { row: number; message: string }[] };

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const birthDate = parseDate(r.fechaNacimiento);
        const gender = parseGender(r.genero);
        if (!birthDate) { result.errors.push({ row: i + 1, message: `Fecha de nacimiento inválida: "${r.fechaNacimiento}"` }); continue; }
        if (!gender) { result.errors.push({ row: i + 1, message: `Género inválido: "${r.genero}"` }); continue; }
        let beltLevelId: string | null = null;
        if (r.cinturon) {
          beltLevelId = beltByName.get(norm(r.cinturon)) ?? null;
          if (!beltLevelId) { result.errors.push({ row: i + 1, message: `Cinturón desconocido: "${r.cinturon}"` }); continue; }
        }
        let academyId: string | null = null;
        if (r.academia?.trim()) {
          const k = norm(r.academia);
          academyId = academies.get(k) ?? null;
          if (!academyId) {
            const a = await prisma.academy.create({ data: { name: r.academia.trim() } });
            academies.set(k, a.id);
            academyId = a.id;
          }
        }
        const data = { firstName: r.nombres.trim(), lastName: r.apellidos.trim(), birthDate, gender, beltLevelId, academyId, email: r.email?.trim() || null, phone: r.telefono?.trim() || null };
        const existing = await prisma.athlete.findUnique({ where: { document: r.documento.trim() } });
        const athlete = existing
          ? await prisma.athlete.update({ where: { id: existing.id }, data })
          : await prisma.athlete.create({ data: { ...data, document: r.documento.trim() } });
        existing ? result.updated++ : result.created++;

        if (tournamentId) {
          const declared = r.pesoDeclarado != null && r.pesoDeclarado !== '' ? Number(String(r.pesoDeclarado).replace(',', '.')) : null;
          const matches = await findMatchingCategories(tournamentId, athlete, Number.isFinite(declared) ? declared : null);
          const categoryId = matches.length === 1 ? matches[0].id : null;
          await prisma.registration.upsert({
            where: { tournamentId_athleteId: { tournamentId, athleteId: athlete.id } },
            create: { tournamentId, athleteId: athlete.id, categoryId, declaredWeight: Number.isFinite(declared) ? declared : null },
            update: { declaredWeight: Number.isFinite(declared) ? declared : undefined, ...(categoryId ? { categoryId } : {}) },
          });
          result.registered++;
          if (categoryId) result.assigned++;
        }
      }
      return result;
    },
  );
};
