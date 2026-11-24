import type { Match, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { generateBracket } from './generator.js';
import { applyResult, type LiveMatch } from './advance.js';
import { computePodium, type Podium } from './podium.js';
import { computeStandings, parseTiebreakRules } from './standings.js';
import type { Slot } from './types.js';

export const matchInclude = {
  red: { include: { athlete: { include: { academy: { select: { id: true, name: true, abbreviation: true } }, beltLevel: { select: { id: true, name: true, color: true, secondary: true } } } } } },
  blue: { include: { athlete: { include: { academy: { select: { id: true, name: true, abbreviation: true } }, beltLevel: { select: { id: true, name: true, color: true, secondary: true } } } } } },
  victoryMethod: { select: { id: true, code: true, name: true } },
  mat: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, tournamentId: true, format: true, durationSec: true } },
} as const;

export function toLive(m: Match): LiveMatch {
  return {
    id: m.id, side: m.side, round: m.round, position: m.position, redId: m.redId, blueId: m.blueId, winnerId: m.winnerId,
    victoryMethodId: m.victoryMethodId, status: m.status, nextMatchId: m.nextMatchId, nextSlot: m.nextSlot as Slot | null,
    loserNextId: m.loserNextId, loserNextSlot: m.loserNextSlot as Slot | null,
  };
}

/** Genera (o regenera) la llave de una categoría. Falla si hay combates iniciados. */
export async function generateForCategory(categoryId: string, opts: { manualSeeding: boolean; avoidSameAcademy?: boolean }) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { registrations: { include: { athlete: true } } } });
  if (!category) throw notFound('Categoría');
  const started = await prisma.match.count({ where: { categoryId, status: { in: ['IN_PROGRESS', 'FINISHED'] } } });
  if (started) throw badRequest('Hay combates iniciados o finalizados: no se puede regenerar la llave');
  const eligible = category.registrations.filter((r) => r.weighInStatus !== 'DISQUALIFIED');
  if (eligible.length < 2) throw badRequest('Se necesitan al menos 2 atletas aptos para generar una llave');

  const gen = generateBracket({
    format: category.format,
    participants: eligible.map((r) => ({ id: r.id, academyId: r.athlete.academyId, seed: r.seed })),
    manualSeeding: opts.manualSeeding,
    avoidSameAcademy: opts.avoidSameAcademy ?? category.avoidSameAcademy,
  });

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { categoryId } });
    // 1ª pasada: crear con ids; 2ª: enlazar next/loserNext
    const idByKey = new Map<string, string>();
    for (const g of gen) {
      const created = await tx.match.create({
        data: {
          categoryId, side: g.side, round: g.round, position: g.position, label: g.label, order: g.order, redId: g.red, blueId: g.blue,
          status: g.status, winnerId: g.winnerId, matId: category.matId,
        },
      });
      idByKey.set(g.key, created.id);
    }
    for (const g of gen) {
      if (!g.nextKey && !g.loserNextKey) continue;
      await tx.match.update({
        where: { id: idByKey.get(g.key)! },
        data: {
          nextMatchId: g.nextKey ? idByKey.get(g.nextKey) : null, nextSlot: g.nextSlot,
          loserNextId: g.loserNextKey ? idByKey.get(g.loserNextKey) : null, loserNextSlot: g.loserNextSlot,
        },
      });
    }
    await tx.category.update({ where: { id: categoryId }, data: { status: 'BRACKET_READY', avoidSameAcademy: opts.avoidSameAcademy ?? category.avoidSameAcademy } });
    if (category.matId) await assignMatOrder(tx, category.matId);
  });
  return getBracket(categoryId);
}

export async function deleteBracket(categoryId: string) {
  const started = await prisma.match.count({ where: { categoryId, status: { in: ['IN_PROGRESS', 'FINISHED'] } } });
  if (started) throw badRequest('Hay combates iniciados o finalizados: no se puede eliminar la llave');
  await prisma.$transaction([
    prisma.match.deleteMany({ where: { categoryId } }),
    prisma.category.update({ where: { id: categoryId }, data: { status: 'OPEN' } }),
  ]);
}

/** Reasigna matOrder secuencial para todos los combates de un tatami (por orden de categoría y de combate). */
export async function assignMatOrder(tx: Prisma.TransactionClient, matId: string) {
  const matches = await tx.match.findMany({ where: { matId, status: { not: 'BYE' } }, include: { category: { select: { order: true, scheduledAt: true } } } });
  matches.sort((a, b) => {
    const ta = a.category.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.category.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ta - tb || a.category.order - b.category.order || a.categoryId.localeCompare(b.categoryId) || a.order - b.order;
  });
  let i = 1;
  for (const m of matches) await tx.match.update({ where: { id: m.id }, data: { matOrder: i++ } });
}

export async function getBracket(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      weightDivision: true, ageGroup: true, beltLevel: true, mat: { select: { id: true, name: true } },
      tournament: { select: { id: true, name: true, sport: { include: { victoryMethods: { orderBy: { order: 'asc' } } } } } },
      registrations: { include: { athlete: { include: { academy: { select: { id: true, name: true, abbreviation: true } }, beltLevel: { select: { id: true, name: true, color: true, secondary: true } } } } } },
      matches: { include: matchInclude, orderBy: [{ order: 'asc' }] },
    },
  });
  if (!category) throw notFound('Categoría');
  const live = category.matches.map(toLive);
  const ids = category.registrations.filter((r) => r.weighInStatus !== 'DISQUALIFIED').map((r) => r.id);
  const methodPoints = Object.fromEntries(category.tournament.sport.victoryMethods.map((m) => [m.id, m.points]));
  const podium = computePodium(category.format, live, ids, { tiebreakRules: category.tiebreakRules, methodPoints, drawOrder: ids });
  const standings = category.format === 'ROUND_ROBIN' ? computeStandings(ids, live, parseTiebreakRules(category.tiebreakRules), methodPoints, ids) : null;
  return { category, matches: category.matches, podium, standings };
}

export async function podiumFor(categoryId: string): Promise<Podium> {
  return (await getBracket(categoryId)).podium;
}

/**
 * Registra o corrige el resultado de un combate con auditoría y propagación.
 */
export async function recordResult(matchId: string, body: { winnerId: string | null; victoryMethodId: string | null; reason?: string }, userId: string | null, isAdmin: boolean) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { category: true } });
  if (!match) throw notFound('Combate');
  if (match.status === 'BYE') throw badRequest('Un BYE no tiene resultado');
  if (body.winnerId && (!match.redId || !match.blueId)) throw badRequest('El combate aún no tiene a los dos participantes');
  if (match.status === 'FINISHED' && !isAdmin && !body.reason) throw badRequest('Para corregir un resultado indica un motivo');

  const all = await prisma.match.findMany({ where: { categoryId: match.categoryId } });
  const live = all.map(toLive);
  const changes = applyResult(live, matchId, body.winnerId, body.victoryMethodId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.resultAudit.create({
      data: {
        matchId, userId, previousWinnerId: match.winnerId, previousMethodId: match.victoryMethodId, previousStatus: match.status,
        newWinnerId: body.winnerId, newMethodId: body.winnerId ? body.victoryMethodId : null, newStatus: body.winnerId ? 'FINISHED' : 'PENDING', reason: body.reason,
      },
    });
    for (const c of changes) {
      const patch: Prisma.MatchUncheckedUpdateInput = {};
      if ('redId' in c.patch) patch.redId = c.patch.redId;
      if ('blueId' in c.patch) patch.blueId = c.patch.blueId;
      if ('winnerId' in c.patch) patch.winnerId = c.patch.winnerId;
      if ('victoryMethodId' in c.patch) patch.victoryMethodId = c.patch.victoryMethodId;
      if ('status' in c.patch) patch.status = c.patch.status;
      if (c.id === matchId) {
        patch.finishedAt = body.winnerId ? now : null;
        patch.resultById = userId;
        if (!body.winnerId) patch.startedAt = null;
      }
      if (c.invalidated) {
        patch.finishedAt = null;
        patch.startedAt = null;
        await tx.resultAudit.create({ data: { matchId: c.id, userId, previousStatus: 'FINISHED', newStatus: 'PENDING', reason: `Invalidado por corrección del combate ${matchId}` } });
      }
      await tx.match.update({ where: { id: c.id }, data: patch });
    }
    await refreshCategoryStatus(tx, match.categoryId);
  });
  return prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: matchInclude });
}

export async function refreshCategoryStatus(tx: Prisma.TransactionClient, categoryId: string) {
  const ms = await tx.match.findMany({ where: { categoryId }, select: { status: true } });
  if (!ms.length) return;
  const real = ms.filter((m) => m.status !== 'BYE');
  const status = real.length && real.every((m) => m.status === 'FINISHED') ? 'FINISHED' : real.some((m) => m.status !== 'PENDING') ? 'IN_PROGRESS' : 'BRACKET_READY';
  await tx.category.update({ where: { id: categoryId }, data: { status } });
  const cat = await tx.category.findUniqueOrThrow({ where: { id: categoryId }, select: { tournamentId: true } });
  const t = await tx.tournament.findUniqueOrThrow({ where: { id: cat.tournamentId } });
  if (status !== 'BRACKET_READY' && (t.status === 'WEIGH_IN' || t.status === 'REGISTRATION' || t.status === 'DRAFT')) {
    await tx.tournament.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS' } });
  }
}
