import type { GenMatch, GenerateOptions, Participant, Slot } from './types.js';

type Source =
  | { kind: 'participant'; id: string }
  | { kind: 'winnerOf'; key: string }
  | { kind: 'loserOf'; key: string }
  | { kind: 'void' };

interface Draft {
  key: string;
  side: GenMatch['side'];
  round: number;
  position: number;
  label?: string;
  red: Source;
  blue: Source;
  nextKey: string | null;
  nextSlot: Slot | null;
  loserNextKey: string | null;
  loserNextSlot: Slot | null;
}

/** Potencia de 2 igual o superior a n (mínimo 2). */
export function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/** Orden estándar de siembra para una llave de tamaño `size` (1-indexed). Ej. 8 → [1,8,4,5,2,7,3,6]. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  return order;
}

export function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ordena participantes: los sembrados manualmente primero (por seed), el resto al azar.
 */
export function orderParticipants(ps: Participant[], manualSeeding: boolean, random: () => number): Participant[] {
  if (manualSeeding) {
    const seeded = ps.filter((p) => p.seed != null).sort((a, b) => (a.seed! - b.seed!));
    const rest = shuffle(ps.filter((p) => p.seed == null), random);
    return [...seeded, ...rest];
  }
  return shuffle(ps, random);
}

/**
 * Intenta que atletas de la misma academia no se crucen en la primera ronda.
 * Trabaja sobre los "slots" (array de tamaño potencia de 2, con null = BYE), por pares (2i, 2i+1).
 * Solo intercambia participantes no sembrados manualmente.
 */
export function avoidSameAcademyFirstRound(slots: (Participant | null)[], lockedIds: Set<string>): (Participant | null)[] {
  const s = [...slots];
  const pairs = s.length / 2;
  const sameAcademy = (a: Participant | null, b: Participant | null) =>
    !!a && !!b && !!a.academyId && !!b.academyId && a.academyId === b.academyId;
  const movable = (p: Participant | null) => !!p && !lockedIds.has(p.id);

  for (let attempt = 0; attempt < 3; attempt++) {
    let changed = false;
    for (let i = 0; i < pairs; i++) {
      const a = s[2 * i];
      const b = s[2 * i + 1];
      if (!sameAcademy(a, b)) continue;
      // buscar un candidato en otro par para intercambiar con b
      for (let j = 0; j < pairs && !changed; j++) {
        if (j === i) continue;
        for (const idx of [2 * j, 2 * j + 1]) {
          const c = s[idx];
          const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
          const partner = s[partnerIdx];
          if (!movable(b) || !movable(c)) continue;
          // tras el intercambio: (a, c) y (partner, b)
          if (!sameAcademy(a, c) && !sameAcademy(partner, b)) {
            s[2 * i + 1] = c;
            s[idx] = b;
            changed = true;
            break;
          }
        }
      }
    }
    if (!changed) break;
  }
  return s;
}

/* -------------------------------------------------------------------------- */
/*  Generación                                                                */
/* -------------------------------------------------------------------------- */

export function generateBracket(opts: GenerateOptions): GenMatch[] {
  const random = opts.random ?? Math.random;
  const participants = opts.participants;
  if (participants.length < 2) return [];
  const ordered = orderParticipants(participants, !!opts.manualSeeding, random);
  const locked = new Set(opts.manualSeeding ? participants.filter((p) => p.seed != null).map((p) => p.id) : []);

  switch (opts.format) {
    case 'ROUND_ROBIN':
      return roundRobin(ordered);
    case 'SINGLE_ELIMINATION':
    case 'SINGLE_ELIMINATION_BRONZE':
    case 'DOUBLE_ELIMINATION': {
      const slots = placeInSlots(ordered, opts.avoidSameAcademy ?? true, locked);
      const drafts =
        opts.format === 'DOUBLE_ELIMINATION'
          ? buildDoubleElimination(slots)
          : buildSingleElimination(slots, opts.format === 'SINGLE_ELIMINATION_BRONZE');
      return resolve(drafts);
    }
  }
}

function placeInSlots(ordered: Participant[], avoid: boolean, locked: Set<string>): (Participant | null)[] {
  const size = nextPowerOfTwo(ordered.length);
  const order = seedOrder(size);
  const slots: (Participant | null)[] = new Array(size).fill(null);
  order.forEach((seed, slotIndex) => {
    slots[slotIndex] = ordered[seed - 1] ?? null;
  });
  return avoid ? avoidSameAcademyFirstRound(slots, locked) : slots;
}

function src(p: Participant | null): Source {
  return p ? { kind: 'participant', id: p.id } : { kind: 'void' };
}

function roundLabel(roundsFromEnd: number, side: Draft['side']): string | undefined {
  if (side !== 'WINNERS') return undefined;
  if (roundsFromEnd === 0) return 'Final';
  if (roundsFromEnd === 1) return 'Semifinal';
  if (roundsFromEnd === 2) return 'Cuartos de final';
  if (roundsFromEnd === 3) return 'Octavos de final';
  return undefined;
}

function buildSingleElimination(slots: (Participant | null)[], withBronze: boolean): Draft[] {
  const size = slots.length;
  const rounds = Math.log2(size);
  const drafts: Draft[] = [];
  const keyOf = (r: number, p: number) => `W${r}-${p}`;

  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let p = 0; p < count; p++) {
      const isLast = r === rounds;
      const d: Draft = {
        key: keyOf(r, p),
        side: 'WINNERS',
        round: r,
        position: p,
        label: roundLabel(rounds - r, 'WINNERS'),
        red: r === 1 ? src(slots[2 * p]) : { kind: 'winnerOf', key: keyOf(r - 1, 2 * p) },
        blue: r === 1 ? src(slots[2 * p + 1]) : { kind: 'winnerOf', key: keyOf(r - 1, 2 * p + 1) },
        nextKey: isLast ? null : keyOf(r + 1, Math.floor(p / 2)),
        nextSlot: isLast ? null : p % 2 === 0 ? 'red' : 'blue',
        loserNextKey: null,
        loserNextSlot: null,
      };
      drafts.push(d);
    }
  }
  if (withBronze && rounds >= 2) {
    const semiA = keyOf(rounds - 1, 0);
    const semiB = keyOf(rounds - 1, 1);
    drafts.push({
      key: 'B3',
      side: 'THIRD_PLACE',
      round: rounds,
      position: 0,
      label: 'Tercer lugar',
      red: { kind: 'loserOf', key: semiA },
      blue: { kind: 'loserOf', key: semiB },
      nextKey: null,
      nextSlot: null,
      loserNextKey: null,
      loserNextSlot: null,
    });
    const a = drafts.find((d) => d.key === semiA)!;
    const b = drafts.find((d) => d.key === semiB)!;
    a.loserNextKey = 'B3';
    a.loserNextSlot = 'red';
    b.loserNextKey = 'B3';
    b.loserNextSlot = 'blue';
  }
  return drafts;
}

/**
 * Eliminación doble estándar: llave de ganadores (WB) + repechaje (LB) + gran final única.
 * Para size = 2^k: WB tiene k rondas, LB tiene 2(k-1) rondas.
 *   LB ronda impar (2i-1): se enfrentan entre sí los que ya están en LB.
 *   LB ronda par (2i):     ganadores de la ronda LB anterior vs perdedores de WB ronda i+1.
 */
function buildDoubleElimination(slots: (Participant | null)[]): Draft[] {
  const size = slots.length;
  const k = Math.log2(size);
  const drafts = buildSingleElimination(slots, false);
  const wb = (r: number, p: number) => `W${r}-${p}`;
  const lb = (r: number, p: number) => `L${r}-${p}`;
  const byKey = new Map(drafts.map((d) => [d.key, d]));

  if (k === 1) {
    // 2 participantes: una sola final, sin repechaje.
    return drafts;
  }

  // WB final ya no es "Final": va a la gran final
  const wbFinal = byKey.get(wb(k, 0))!;
  wbFinal.label = 'Final de ganadores';
  wbFinal.nextKey = 'GF';
  wbFinal.nextSlot = 'red';

  const lbRounds = 2 * (k - 1);
  // LB ronda 1: perdedores de WB ronda 1 (size/2 perdedores → size/4 combates)
  for (let r = 1; r <= lbRounds; r++) {
    const count = r % 2 === 1 ? size / 2 ** ((r + 1) / 2 + 1) : size / 2 ** (r / 2 + 1);
    for (let p = 0; p < count; p++) {
      let red: Source;
      let blue: Source;
      if (r === 1) {
        red = { kind: 'loserOf', key: wb(1, 2 * p) };
        blue = { kind: 'loserOf', key: wb(1, 2 * p + 1) };
      } else if (r % 2 === 0) {
        // vs perdedores de WB ronda r/2 + 1; se cruzan en orden inverso para evitar revanchas tempranas
        const wbRound = r / 2 + 1;
        red = { kind: 'winnerOf', key: lb(r - 1, p) };
        blue = { kind: 'loserOf', key: wb(wbRound, count - 1 - p) };
      } else {
        red = { kind: 'winnerOf', key: lb(r - 1, 2 * p) };
        blue = { kind: 'winnerOf', key: lb(r - 1, 2 * p + 1) };
      }
      const isLast = r === lbRounds;
      const d: Draft = {
        key: lb(r, p),
        side: 'LOSERS',
        round: r,
        position: p,
        label: isLast ? 'Final de repechaje' : undefined,
        red,
        blue,
        nextKey: isLast ? 'GF' : lb(r + 1, r % 2 === 1 ? p : Math.floor(p / 2)),
        nextSlot: isLast ? 'blue' : r % 2 === 1 ? 'red' : p % 2 === 0 ? 'red' : 'blue',
        loserNextKey: null,
        loserNextSlot: null,
      };
      drafts.push(d);
      byKey.set(d.key, d);
    }
  }
  // enlazar perdedores de WB → LB
  for (let p = 0; p < size / 2; p++) {
    const m = byKey.get(wb(1, p))!;
    m.loserNextKey = lb(1, Math.floor(p / 2));
    m.loserNextSlot = p % 2 === 0 ? 'red' : 'blue';
  }
  for (let wr = 2; wr <= k; wr++) {
    const lbRound = 2 * (wr - 1);
    const count = size / 2 ** wr;
    for (let p = 0; p < count; p++) {
      const m = byKey.get(wb(wr, p))!;
      m.loserNextKey = lb(lbRound, count - 1 - p);
      m.loserNextSlot = 'blue';
    }
  }
  drafts.push({
    key: 'GF',
    side: 'GRAND_FINAL',
    round: k + 1,
    position: 0,
    label: 'Gran final',
    red: { kind: 'winnerOf', key: wb(k, 0) },
    blue: { kind: 'winnerOf', key: lb(lbRounds, 0) },
    nextKey: null,
    nextSlot: null,
    loserNextKey: null,
    loserNextSlot: null,
  });
  return drafts;
}

/**
 * Resuelve BYEs:
 *  - participante vs vacío → combate BYE con ganador predefinido.
 *  - pendiente vs vacío    → se colapsa: la fuente se re-cablea al siguiente combate.
 *  - vacío vs vacío        → se elimina.
 */
function resolve(drafts: Draft[]): GenMatch[] {
  const byKey = new Map(drafts.map((d) => [d.key, d]));
  type Res = { kind: 'participant'; id: string } | { kind: 'void' } | { kind: 'pending' };
  const resolved = new Map<string, { red: Res; blue: Res; bye: boolean; voided: boolean; winner: string | null }>();

  const resolveSource = (s: Source): Res => {
    if (s.kind === 'participant') return s;
    if (s.kind === 'void') return { kind: 'void' };
    const r = resolved.get(s.key);
    if (!r) return { kind: 'pending' };
    if (r.voided) return { kind: 'void' };
    if (s.kind === 'winnerOf') return r.bye && r.winner ? { kind: 'participant', id: r.winner } : { kind: 'pending' };
    // loserOf
    return r.bye ? { kind: 'void' } : { kind: 'pending' };
  };

  // Iterar hasta estabilidad (incluye colapsos de pendiente-vs-vacío)
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    resolved.clear();
    for (const d of drafts) {
      const red = resolveSource(d.red);
      const blue = resolveSource(d.blue);
      const voided = red.kind === 'void' && blue.kind === 'void';
      const bye = (red.kind === 'participant' && blue.kind === 'void') || (blue.kind === 'participant' && red.kind === 'void');
      const winner = bye ? (red.kind === 'participant' ? red.id : (blue as { id: string }).id) : null;
      resolved.set(d.key, { red, blue, bye, voided, winner });
    }
    // colapsar pendiente-vs-vacío
    for (const d of drafts) {
      const r = resolved.get(d.key)!;
      const pendingSlot: Slot | null =
        r.red.kind === 'pending' && r.blue.kind === 'void' ? 'red' : r.blue.kind === 'pending' && r.red.kind === 'void' ? 'blue' : null;
      if (!pendingSlot) continue;
      const feed = pendingSlot === 'red' ? d.red : d.blue;
      if (feed.kind !== 'winnerOf' && feed.kind !== 'loserOf') continue;
      const source = byKey.get(feed.key)!;
      // re-cablear fuente → d.next
      if (feed.kind === 'winnerOf') {
        source.nextKey = d.nextKey;
        source.nextSlot = d.nextSlot;
      } else {
        source.loserNextKey = d.nextKey;
        source.loserNextSlot = d.nextSlot;
      }
      if (d.nextKey) {
        const next = byKey.get(d.nextKey)!;
        const newSrc: Source = feed.kind === 'winnerOf' ? { kind: 'winnerOf', key: feed.key } : { kind: 'loserOf', key: feed.key };
        if (d.nextSlot === 'red') next.red = newSrc;
        else next.blue = newSrc;
      }
      // el perdedor de d (que ya no existe) → vacío en su destino
      if (d.loserNextKey) {
        const ln = byKey.get(d.loserNextKey)!;
        if (d.loserNextSlot === 'red') ln.red = { kind: 'void' };
        else ln.blue = { kind: 'void' };
      }
      // d queda vacío
      d.red = { kind: 'void' };
      d.blue = { kind: 'void' };
      changed = true;
    }
  }

  const alive = drafts.filter((d) => !resolved.get(d.key)!.voided);
  const aliveKeys = new Set(alive.map((d) => d.key));
  let order = 0;
  const sideRank: Record<string, number> = { WINNERS: 0, LOSERS: 1, THIRD_PLACE: 2, GRAND_FINAL: 3, ROUND_ROBIN: 0 };
  // orden de ejecución: por ronda intercalando WB/LB razonablemente
  const sorted = [...alive].sort((a, b) => {
    const ra = execRound(a);
    const rb = execRound(b);
    if (ra !== rb) return ra - rb;
    if (sideRank[a.side] !== sideRank[b.side]) return sideRank[a.side] - sideRank[b.side];
    return a.position - b.position;
  });
  return sorted.map((d) => {
    const r = resolved.get(d.key)!;
    const toId = (x: Res) => (x.kind === 'participant' ? x.id : null);
    return {
      key: d.key,
      side: d.side,
      round: d.round,
      position: d.position,
      label: d.label,
      order: order++,
      red: toId(r.red),
      blue: toId(r.blue),
      status: r.bye ? 'BYE' : 'PENDING',
      winnerId: r.bye ? r.winner : null,
      nextKey: d.nextKey && aliveKeys.has(d.nextKey) ? d.nextKey : null,
      nextSlot: d.nextKey && aliveKeys.has(d.nextKey) ? d.nextSlot : null,
      loserNextKey: d.loserNextKey && aliveKeys.has(d.loserNextKey) ? d.loserNextKey : null,
      loserNextSlot: d.loserNextKey && aliveKeys.has(d.loserNextKey) ? d.loserNextSlot : null,
    };
  });
}

/** Ronda "de ejecución" para ordenar la cola: LB ronda r ocurre aprox. tras WB ronda ceil(r/2)+1. */
function execRound(d: Draft): number {
  if (d.side === 'WINNERS') return d.round * 2;
  if (d.side === 'LOSERS') return d.round * 2 + 1;
  if (d.side === 'THIRD_PLACE') return d.round * 2 + 1;
  return 10_000; // gran final al final
}

/** Round robin con método del círculo; devuelve rondas con combates "todos contra todos". */
function roundRobin(ordered: Participant[]): GenMatch[] {
  const ids: (string | null)[] = ordered.map((p) => p.id);
  if (ids.length % 2 === 1) ids.push(null); // comodín
  const n = ids.length;
  const rounds = n - 1;
  const out: GenMatch[] = [];
  let order = 0;
  const arr = [...ids];
  for (let r = 1; r <= rounds; r++) {
    let pos = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a == null || b == null) continue;
      out.push({
        key: `RR${r}-${pos}`,
        side: 'ROUND_ROBIN',
        round: r,
        position: pos++,
        label: `Ronda ${r}`,
        order: order++,
        red: a,
        blue: b,
        status: 'PENDING',
        winnerId: null,
        nextKey: null,
        nextSlot: null,
        loserNextKey: null,
        loserNextSlot: null,
      });
    }
    // rotar (fijando el primero)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return out;
}
