/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { generateForCategory, recordResult } from '../src/modules/brackets/service.js';
import { findMatchingCategories } from '../src/modules/categories/service.js';
import { buildCategoryName } from '../src/modules/categories/service.js';
import { validateWeight } from '../src/modules/registrations/weighin.js';
import { seedCredentials } from './seed-credentials.js';

// PRNG determinístico para que el seed sea reproducible
let s = 20261109;
const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

async function main() {
  // Antes de borrar nada: si faltan las credenciales de producción, se aborta sin tocar la BD
  const cred = seedCredentials();
  console.log('🧹 Limpiando base de datos…');
  await prisma.resultAudit.deleteMany();
  await prisma.match.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.matAssignment.deleteMany();
  await prisma.mat.deleteMany();
  await prisma.weightDivision.deleteMany();
  await prisma.ageGroup.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.athlete.deleteMany();
  await prisma.academy.deleteMany();
  await prisma.sport.deleteMany();
  await prisma.user.deleteMany();

  console.log('👤 Usuarios…');
  const admin = await prisma.user.create({ data: { email: cred.adminEmail, name: 'Administración', role: 'ADMIN', passwordHash: await bcrypt.hash(cred.adminPassword, 10) } });
  const mesa1 = await prisma.user.create({ data: { email: 'mesa@torneo.dojo', name: 'Mesa Tatami 1', role: 'TABLE', passwordHash: await bcrypt.hash(cred.tablePassword, 10) } });
  const mesa2 = await prisma.user.create({ data: { email: 'mesa2@torneo.dojo', name: 'Mesa Tatami 2', role: 'TABLE', passwordHash: await bcrypt.hash(cred.tablePassword, 10) } });

  console.log('🥋 Deporte: Jiu-Jitsu Brasileño…');
  const bjj = await prisma.sport.create({
    data: {
      name: 'Jiu-Jitsu Brasileño', slug: 'bjj', defaultDurationSec: 360, description: 'Grappling con kimono. Reglas basadas en IBJJF.',
      victoryMethods: {
        create: [
          { code: 'SUBMISSION', name: 'Sumisión', order: 1, points: 4 },
          { code: 'POINTS', name: 'Puntos', order: 2, points: 3 },
          { code: 'ADVANTAGES', name: 'Ventajas', order: 3, points: 2 },
          { code: 'DECISION', name: 'Decisión del árbitro', order: 4, points: 1 },
          { code: 'DQ', name: 'Descalificación', order: 5, points: 3 },
          { code: 'WO', name: 'W.O. (no se presentó)', order: 6, points: 3 },
        ],
      },
      beltLevels: {
        create: [
          { name: 'Blanca', color: '#f5f5f0', order: 1 },
          { name: 'Gris', color: '#9aa0a6', secondary: '#f5f5f0', order: 2 },
          { name: 'Amarilla', color: '#f2c230', secondary: '#f5f5f0', order: 3 },
          { name: 'Naranja', color: '#ef8a2b', secondary: '#f5f5f0', order: 4 },
          { name: 'Verde', color: '#2e9e5b', secondary: '#f5f5f0', order: 5 },
          { name: 'Azul', color: '#2a63c9', order: 6 },
          { name: 'Morada', color: '#7a3fb5', order: 7 },
          { name: 'Marrón', color: '#7a4a24', order: 8 },
          { name: 'Negra', color: '#1a1a1a', secondary: '#c8373b', order: 9 },
        ],
      },
    },
    include: { beltLevels: true, victoryMethods: true },
  });
  const belt = (n: string) => bjj.beltLevels.find((b) => b.name === n)!;
  const method = (c: string) => bjj.victoryMethods.find((m) => m.code === c)!;

  // Segundo deporte de ejemplo (sin torneo) para mostrar multi-deporte
  await prisma.sport.create({
    data: {
      name: 'Judo', slug: 'judo', defaultDurationSec: 240,
      victoryMethods: { create: [{ code: 'IPPON', name: 'Ippon', order: 1, points: 3 }, { code: 'WAZA_ARI', name: 'Waza-ari', order: 2, points: 2 }, { code: 'HANSOKU', name: 'Hansoku-make', order: 3, points: 3 }, { code: 'WO', name: 'W.O.', order: 4, points: 3 }] },
      beltLevels: { create: [{ name: 'Blanco', color: '#f5f5f0', order: 1 }, { name: 'Amarillo', color: '#f2c230', order: 2 }, { name: 'Naranja', color: '#ef8a2b', order: 3 }, { name: 'Verde', color: '#2e9e5b', order: 4 }, { name: 'Azul', color: '#2a63c9', order: 5 }, { name: 'Marrón', color: '#7a4a24', order: 6 }, { name: 'Negro', color: '#1a1a1a', order: 7 }] },
    },
  });

  console.log('🏯 Academias…');
  const academyData = [
    { name: 'Dojo Central Madrid', abbreviation: 'DCM', city: 'Madrid', color: '#c8373b' },
    { name: 'Gracie Norte', abbreviation: 'GRN', city: 'Bilbao', color: '#2a63c9' },
    { name: 'Alliance Sur', abbreviation: 'ALS', city: 'Sevilla', color: '#2e9e5b' },
    { name: 'Checkmat Levante', abbreviation: 'CKL', city: 'Valencia', color: '#f2c230' },
    { name: 'Atos Atlántico', abbreviation: 'ATA', city: 'A Coruña', color: '#7a3fb5' },
    { name: 'Kimura Team', abbreviation: 'KMT', city: 'Zaragoza', color: '#ef8a2b' },
  ];
  const academies = await Promise.all(academyData.map((a) => prisma.academy.create({ data: a })));

  console.log('🏆 Torneo…');
  const start = new Date('2026-11-21T09:00:00Z');
  const tournament = await prisma.tournament.create({
    data: {
      name: 'Open de Madrid 2026', venue: 'Pabellón Municipal Shiro', city: 'Madrid', startDate: start, endDate: new Date('2026-11-22T20:00:00Z'),
      status: 'IN_PROGRESS', sportId: bjj.id, pointsGold: 9, pointsSilver: 3, pointsBronze: 1,
      description: 'Torneo abierto de Jiu-Jitsu con kimono. Categorías adulto y master, todos los cinturones.',
      ageGroups: { create: [{ name: 'Juvenil', minAge: 16, maxAge: 17, order: 1 }, { name: 'Adulto', minAge: 18, maxAge: 29, order: 2 }, { name: 'Master', minAge: 30, maxAge: 99, order: 3 }] },
      weightDivs: {
        create: [
          { name: 'Pluma', minKg: null, maxKg: 70, gender: 'M', order: 1 },
          { name: 'Ligero', minKg: 70.01, maxKg: 76, gender: 'M', order: 2 },
          { name: 'Medio', minKg: 76.01, maxKg: 82.3, gender: 'M', order: 3 },
          { name: 'Medio pesado', minKg: 82.31, maxKg: 88.3, gender: 'M', order: 4 },
          { name: 'Pesado', minKg: 88.31, maxKg: null, gender: 'M', order: 5 },
          { name: 'Pluma', minKg: null, maxKg: 58.5, gender: 'F', order: 6 },
          { name: 'Ligero', minKg: 58.51, maxKg: 64, gender: 'F', order: 7 },
          { name: 'Medio', minKg: 64.01, maxKg: 69, gender: 'F', order: 8 },
          { name: 'Pesado', minKg: 69.01, maxKg: null, gender: 'F', order: 9 },
        ],
      },
      mats: { create: [{ name: 'Tatami 1', order: 1, color: '#c8373b' }, { name: 'Tatami 2', order: 2, color: '#2a63c9' }, { name: 'Tatami 3', order: 3, color: '#2e9e5b' }] },
    },
    include: { ageGroups: true, weightDivs: true, mats: true },
  });
  const age = (n: string) => tournament.ageGroups.find((a) => a.name === n)!;
  const div = (n: string, g: 'M' | 'F') => tournament.weightDivs.find((d) => d.name === n && d.gender === g)!;
  const [mat1, mat2, mat3] = tournament.mats;
  await prisma.matAssignment.createMany({ data: [{ userId: mesa1.id, matId: mat1.id }, { userId: mesa2.id, matId: mat2.id }, { userId: mesa2.id, matId: mat3.id }] });

  console.log('📋 Categorías…');
  const catDefs: { age: string; gender: 'M' | 'F'; belt: string; div: string; format: 'SINGLE_ELIMINATION' | 'SINGLE_ELIMINATION_BRONZE' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN'; mat: typeof mat1; hour: number }[] = [
    { age: 'Adulto', gender: 'M', belt: 'Blanca', div: 'Pluma', format: 'SINGLE_ELIMINATION', mat: mat1, hour: 9 },
    { age: 'Adulto', gender: 'M', belt: 'Blanca', div: 'Ligero', format: 'SINGLE_ELIMINATION', mat: mat1, hour: 10 },
    { age: 'Adulto', gender: 'M', belt: 'Azul', div: 'Medio', format: 'DOUBLE_ELIMINATION', mat: mat2, hour: 9 },
    { age: 'Adulto', gender: 'M', belt: 'Morada', div: 'Pesado', format: 'SINGLE_ELIMINATION_BRONZE', mat: mat2, hour: 11 },
    { age: 'Adulto', gender: 'F', belt: 'Blanca', div: 'Ligero', format: 'ROUND_ROBIN', mat: mat3, hour: 9 },
    { age: 'Adulto', gender: 'F', belt: 'Azul', div: 'Pluma', format: 'SINGLE_ELIMINATION', mat: mat3, hour: 10 },
    { age: 'Master', gender: 'M', belt: 'Negra', div: 'Medio pesado', format: 'ROUND_ROBIN', mat: mat1, hour: 12 },
    { age: 'Master', gender: 'M', belt: 'Marrón', div: 'Medio', format: 'SINGLE_ELIMINATION', mat: mat2, hour: 12 },
  ];
  const categories = [];
  let order = 0;
  for (const c of catDefs) {
    const d = div(c.div, c.gender);
    const cat = await prisma.category.create({
      data: {
        tournamentId: tournament.id, name: buildCategoryName({ ageGroup: c.age, gender: c.gender, belt: c.belt, division: c.div }), gender: c.gender,
        ageGroupId: age(c.age).id, weightDivisionId: d.id, beltLevelId: belt(c.belt).id, format: c.format, matId: c.mat.id, order: order++,
        scheduledAt: new Date(Date.UTC(2026, 10, 21, c.hour - 1, 0)), // 9:00 hora Madrid aprox.
      },
    });
    categories.push({ ...cat, def: c, division: d });
  }

  console.log('🧍 Atletas e inscripciones…');
  const maleNames = ['Hugo', 'Mateo', 'Martín', 'Lucas', 'Leo', 'Daniel', 'Alejandro', 'Pablo', 'Manuel', 'Álvaro', 'Adrián', 'David', 'Mario', 'Diego', 'Javier', 'Izan', 'Bruno', 'Oliver', 'Thiago', 'Marcos', 'Carlos', 'Antonio', 'Rafael', 'Sergio', 'Iván', 'Gonzalo', 'Nicolás', 'Enzo'];
  const femaleNames = ['Lucía', 'Sofía', 'Martina', 'María', 'Julia', 'Paula', 'Valeria', 'Emma', 'Daniela', 'Carla', 'Alba', 'Noa', 'Sara', 'Carmen', 'Vega', 'Olivia', 'Claudia', 'Lara', 'Jimena', 'Ana'];
  const surnames = ['García', 'Rodríguez', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Díaz', 'Torres', 'Ruiz', 'Hernández', 'Jiménez', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Ortega', 'Delgado', 'Castro', 'Vargas', 'Silva', 'Souza', 'Oliveira'];
  const perCategory: Record<string, number> = { 'Adulto|M|Blanca|Pluma': 7, 'Adulto|M|Blanca|Ligero': 8, 'Adulto|M|Azul|Medio': 6, 'Adulto|M|Morada|Pesado': 5, 'Adulto|F|Blanca|Ligero': 5, 'Adulto|F|Azul|Pluma': 4, 'Master|M|Negra|Medio pesado': 4, 'Master|M|Marrón|Medio': 3 };
  let doc = 40000000;
  const usedNames = new Set<string>();
  const registrations: { id: string; categoryId: string }[] = [];
  for (const cat of categories) {
    const key = `${cat.def.age}|${cat.def.gender}|${cat.def.belt}|${cat.def.div}`;
    const n = perCategory[key] ?? 4;
    const minKg = cat.division.minKg ?? (cat.division.maxKg! - 8);
    const maxKg = cat.division.maxKg ?? minKg + 12;
    for (let i = 0; i < n; i++) {
      let first = pick(cat.def.gender === 'M' ? maleNames : femaleNames);
      let last = `${pick(surnames)} ${pick(surnames)}`;
      while (usedNames.has(first + last)) { first = pick(cat.def.gender === 'M' ? maleNames : femaleNames); last = `${pick(surnames)} ${pick(surnames)}`; }
      usedNames.add(first + last);
      const birthYear = cat.def.age === 'Adulto' ? 1997 + Math.floor(rnd() * 11) : 1975 + Math.floor(rnd() * 20);
      const athlete = await prisma.athlete.create({
        data: {
          firstName: first, lastName: last, document: String(doc++), gender: cat.def.gender,
          birthDate: new Date(Date.UTC(birthYear, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28))),
          beltLevelId: belt(cat.def.belt).id, academyId: pick(academies).id,
          email: `${first.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${last.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@example.com`,
          phone: `+34 6${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`,
        },
      });
      // peso real: la mayoría dentro del rango; algunos sin pesar
      const weight = Math.round((minKg + rnd() * (maxKg - minKg)) * 10) / 10;
      const weighed = rnd() > 0.1;
      const matches = await findMatchingCategories(tournament.id, athlete, weight);
      const categoryId = matches.find((m) => m.id === cat.id)?.id ?? cat.id;
      const reg = await prisma.registration.create({
        data: {
          tournamentId: tournament.id, athleteId: athlete.id, categoryId, declaredWeight: weight,
          ...(weighed ? { weightKg: weight, weighedAt: new Date(), weighInStatus: validateWeight(weight, cat.division) } : {}),
        },
      });
      registrations.push({ id: reg.id, categoryId });
    }
  }
  // Un atleta con sobrepeso sin resolver, para probar el flujo de pesaje
  const overweightCat = categories[1];
  const ow = await prisma.athlete.create({ data: { firstName: 'Ramón', lastName: 'Ibáñez Cuesta', document: String(doc++), gender: 'M', birthDate: new Date('2000-05-05'), beltLevelId: belt('Blanca').id, academyId: academies[5].id } });
  await prisma.registration.create({ data: { tournamentId: tournament.id, athleteId: ow.id, categoryId: overweightCat.id, declaredWeight: 75.5, weightKg: 77.2, weighedAt: new Date(), weighInStatus: 'OVERWEIGHT' } });
  // Dos atletas pendientes de pesaje en una categoría sin llave
  for (const [f, l] of [['Elena', 'Prieto Mora'], ['Irene', 'Campos Vidal']]) {
    const a = await prisma.athlete.create({ data: { firstName: f, lastName: l, document: String(doc++), gender: 'F', birthDate: new Date('1999-02-02'), beltLevelId: belt('Azul').id, academyId: pick(academies).id } });
    await prisma.registration.create({ data: { tournamentId: tournament.id, athleteId: a.id, categoryId: categories[5].id, declaredWeight: 57 } });
  }

  console.log('🔀 Generando llaves y registrando resultados de ejemplo…');
  // Categorías 0..4 con llave; la 0 y la 4 completas, la 2 a medias, la 1 y 3 solo con llave
  const withBracket = [0, 1, 2, 3, 4, 6];
  for (const i of withBracket) await generateForCategory(categories[i].id, { manualSeeding: false });

  const playAll = async (categoryId: string, fraction = 1) => {
    let guard = 0;
    while (guard++ < 200) {
      const pending = await prisma.match.findMany({ where: { categoryId, status: 'PENDING', redId: { not: null }, blueId: { not: null } }, orderBy: { order: 'asc' } });
      const total = await prisma.match.count({ where: { categoryId, status: { not: 'BYE' } } });
      const finished = await prisma.match.count({ where: { categoryId, status: 'FINISHED' } });
      if (!pending.length || finished / total >= fraction) break;
      const m = pending[0];
      const winnerId = rnd() > 0.5 ? m.redId! : m.blueId!;
      const meth = pick([method('SUBMISSION'), method('SUBMISSION'), method('POINTS'), method('POINTS'), method('ADVANTAGES'), method('DECISION')]);
      await recordResult(m.id, { winnerId, victoryMethodId: meth.id }, mesa1.id, false);
    }
  };
  await playAll(categories[0].id, 1);
  await playAll(categories[4].id, 1);
  await playAll(categories[6].id, 1);
  await playAll(categories[2].id, 0.5);
  // Un combate en curso en el tatami 1
  const inProgress = await prisma.match.findFirst({ where: { categoryId: categories[1].id, status: 'PENDING', redId: { not: null }, blueId: { not: null } }, orderBy: { order: 'asc' } });
  if (inProgress) await prisma.match.update({ where: { id: inProgress.id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
  await prisma.category.update({ where: { id: categories[1].id }, data: { status: 'IN_PROGRESS' } });

  const totals = { atletas: await prisma.athlete.count(), inscripciones: await prisma.registration.count(), categorias: await prisma.category.count(), combates: await prisma.match.count() };
  console.log('✅ Seed completo', totals);
  // Las contraseñas solo se imprimen si son las de desarrollo (nunca las de producción en los logs)
  const pw = (p: string) => (cred.fromEnv ? '(contraseña de las variables SEED_*)' : p);
  console.log(`   ${cred.adminEmail} / ${pw(cred.adminPassword)}   (Administrador)`);
  console.log(`   mesa@torneo.dojo  / ${pw(cred.tablePassword)}    (Mesa — Tatami 1)`);
  console.log(`   mesa2@torneo.dojo / ${pw(cred.tablePassword)}    (Mesa — Tatamis 2 y 3)`);
  void admin;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
