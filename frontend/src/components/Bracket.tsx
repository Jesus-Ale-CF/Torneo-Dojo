import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, ArrowDown, CornerDownRight } from 'lucide-react';
import type { Match } from '@/lib/types';
import { SIDE, roundName } from '@/lib/format';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { BOX_H, BOX_W, MatchBox } from './MatchBox';

const SIDES = ['WINNERS', 'LOSERS', 'THIRD_PLACE', 'GRAND_FINAL'] as const;
const isDone = (m: Match) => m.status === 'FINISHED' || m.status === 'BYE';

type Props = { matches: Match[]; onSelect?: (m: Match) => void; highlightId?: string | null; layout?: 'graphic' | 'vertical' };

/**
 * Llave de eliminación.
 * - `graphic` (por defecto, en cualquier tamaño): gráfico clásico de izquierda a derecha con zoom (Ctrl + rueda / pinza / botones) y arrastre limitado.
 *   En escritorio se ajusta al ancho; en móvil arranca a tamaño legible (una ronda por pantalla) y se desliza a los lados.
 * - `vertical`: rondas de arriba abajo, pensado como alternativa para pantallas estrechas (solo scroll vertical).
 */
export function Bracket({ layout = 'graphic', ...props }: Props) {
  return layout === 'vertical' ? <VerticalBracket {...props} /> : <ZoomableBracket {...props} />;
}

/* ================================================================== VERTICAL (móvil) */

function VerticalBracket({ matches, onSelect, highlightId }: Props) {
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const groups = SIDES.map((s) => ({ s, list: matches.filter((m) => m.side === s) })).filter((g) => g.list.length);
  return (
    <div className="space-y-10" data-testid="bracket-vertical">
      {groups.map((g) => {
        const rounds = [...new Set(g.list.map((m) => m.round))].sort((a, b) => a - b);
        return (
          <section key={g.s} aria-label={SIDE[g.s]}>
            {groups.length > 1 && <h3 className="mb-4 font-display text-base font-bold">{SIDE[g.s]}</h3>}
            {rounds.map((r, ri) => {
              const list = g.list.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
              return (
                <div key={r}>
                  <div className="mb-3 flex items-center gap-3">
                    <h4 className="label shrink-0">{roundTitle(list[0], g.s)}</h4>
                    <span className="h-px flex-1 bg-line" aria-hidden />
                    <span className="num text-xs text-muted">{list.filter(isDone).length}/{list.length}</span>
                  </div>
                  <ol className="space-y-5">
                    {pairUp(list).map((pair) => { const next = pair[0].nextMatchId ? byId.get(pair[0].nextMatchId) : undefined; return <PairBlock key={pair[0].id} pair={pair} next={next} nextName={next ? matchName(next, matches) : ''} onSelect={onSelect} highlightId={highlightId} />; })}
                  </ol>
                  {ri < rounds.length - 1 && <div className="my-4 flex justify-center text-muted" aria-hidden><ArrowDown className="h-5 w-5" /></div>}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

/** Agrupa combates consecutivos que alimentan al mismo combate siguiente. */
function pairUp(list: Match[]): Match[][] {
  const out: Match[][] = [];
  for (const m of list) {
    const last = out[out.length - 1];
    if (last && m.nextMatchId && last[0].nextMatchId === m.nextMatchId && last.length < 2) last.push(m);
    else out.push([m]);
  }
  return out;
}

/** Nombre único de un combate: "Semifinal 2" si hay varios con la misma etiqueta en su ronda. */
function matchName(m: Match, all: Match[]) {
  const base = roundTitle(m, m.side);
  const same = all.filter((x) => x.side === m.side && x.round === m.round);
  return same.length > 1 ? `${base} ${same.sort((a, b) => a.position - b.position).indexOf(m) + 1}` : base;
}

function roundTitle(m: Match, side: string) {
  if (side === 'LOSERS') return m.label ?? `Repechaje · Ronda ${m.round}`;
  return roundName(m);
}

/** Uno o dos combates con un conector "]" a la derecha que indica a qué combate pasa el ganador. */
function PairBlock({ pair, next, nextName, onSelect, highlightId }: { pair: Match[]; next?: Match; nextName: string; onSelect?: (m: Match) => void; highlightId?: string | null }) {
  const done = pair.every(isDone);
  const tone = done ? 'border-gold' : 'border-line';
  return (
    <motion.li layout="position" transition={{ duration: 0.25 }}>
      <div className={`relative ${next ? 'pr-7' : ''}`}>
        <div className="space-y-3">
          {pair.map((m) => <MatchBox key={m.id} m={m} onClick={onSelect} highlight={highlightId === m.id} compact />)}
        </div>
        {next && (
          pair.length === 2 ? (
            <span aria-hidden className={`pointer-events-none absolute right-1 w-5 rounded-r-md border-y-2 border-r-2 transition-colors duration-300 ${tone}`} style={{ top: BOX_H / 2, bottom: BOX_H / 2 }} />
          ) : (
            <span aria-hidden className={`pointer-events-none absolute right-1 w-5 border-t-2 transition-colors duration-300 ${tone}`} style={{ top: BOX_H / 2 }} />
          )
        )}
      </div>
      {next && (
        <p className="mt-4 flex flex-wrap items-center justify-end gap-1 pr-1 text-xs text-muted">
          <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
          {pair.length === 2 ? 'Los ganadores se enfrentan en' : 'El ganador pasa a'} <span className="font-semibold text-ink">{nextName}</span>
        </p>
      )}
    </motion.li>
  );
}

/* ================================================================== HORIZONTAL (tablet / escritorio) */

const COL_GAP = 56;
const ROW_GAP = 30; // sitio para la etiqueta de ronda (arriba) y la de método (abajo)
const PAD = 16;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

interface Pos { m: Match; x: number; y: number }

/** Columnas por ronda; cada combate se centra sobre los que lo alimentan. */
function layoutSide(matches: Match[]): { positions: Pos[]; width: number; height: number } {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const pos = new Map<string, Pos>();
  let height = 0;
  rounds.forEach((r, ri) => {
    const list = matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
    const x = ri * (BOX_W + COL_GAP);
    if (ri === 0) {
      list.forEach((m, i) => pos.set(m.id, { m, x, y: i * (BOX_H + ROW_GAP) }));
      height = Math.max(height, list.length * (BOX_H + ROW_GAP) - ROW_GAP);
      return;
    }
    let cursor = 0;
    list.forEach((m) => {
      const feeders = matches.filter((f) => f.nextMatchId === m.id && f.round < m.round && pos.has(f.id));
      let y = cursor;
      if (feeders.length) {
        const ys = feeders.map((f) => pos.get(f.id)!.y);
        y = (Math.min(...ys) + Math.max(...ys)) / 2;
      }
      y = Math.max(y, cursor);
      pos.set(m.id, { m, x, y });
      cursor = y + BOX_H + ROW_GAP;
      height = Math.max(height, y + BOX_H);
    });
  });
  return { positions: [...pos.values()], width: rounds.length * (BOX_W + COL_GAP) - COL_GAP, height };
}

function Connectors({ positions }: { positions: Pos[] }) {
  const byId = new Map(positions.map((p) => [p.m.id, p]));
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {positions.map((p) => {
        const to = p.m.nextMatchId ? byId.get(p.m.nextMatchId) : undefined;
        if (!to) return null;
        const x1 = p.x + BOX_W, y1 = p.y + BOX_H / 2;
        const x2 = to.x, y2 = to.y + BOX_H / 2 + (p.m.nextSlot === 'red' ? -BOX_H / 4 : BOX_H / 4);
        const d = `M${x1},${y1} H${x1 + COL_GAP / 2} V${y2} H${x2}`;
        return (
          <g key={p.m.id}>
            <path d={d} fill="none" className="stroke-line" strokeWidth={2} />
            {isDone(p.m) && <motion.path d={d} fill="none" className="stroke-gold" strokeWidth={2.5} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} />}
          </g>
        );
      })}
    </svg>
  );
}

function SideBlock({ title, matches, onSelect, highlightId }: { title: string; matches: Match[]; onSelect?: (m: Match) => void; highlightId?: string | null }) {
  const { positions, width, height } = useMemo(() => layoutSide(matches), [matches]);
  return (
    <section className="mb-10 last:mb-0" aria-label={title}>
      <h3 className="label mb-2">{title}</h3>
      <div className="relative mt-6" style={{ width, height }}>
        <Connectors positions={positions} />
        {positions.map((p) => {
          const label = p.m.label ?? (p.m.side === 'LOSERS' ? `Ronda ${p.m.round}` : null);
          const many = p.m.side === 'WINNERS' && matches.filter((x) => x.round === p.m.round).length > 1;
          return (
            <div key={p.m.id} className="absolute" style={{ left: p.x, top: p.y }}>
              {label && label !== title && <span className="absolute -top-4 left-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted">{label}{many && p.m.label ? ` ${p.m.position + 1}` : ''}</span>}
              <MatchBox m={p.m} onClick={onSelect} highlight={highlightId === p.m.id} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ZoomableBracket({ matches, onSelect, highlightId }: Props) {
  // En móvil: altura = contenido completo (la página hace el scroll vertical) y escala inicial legible en vez de "toda la llave"
  const mobile = useMediaQuery('(max-width: 767px)');
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  // Hasta el primer encaje el contenido no se muestra ni se anima: nunca se pinta desbordado
  const [ready, setReady] = useState(false);
  const [smooth, setSmooth] = useState(false); // transición activa solo a partir del fotograma siguiente al primer encaje
  useEffect(() => { if (!ready) return; const r = requestAnimationFrame(() => setSmooth(true)); return () => cancelAnimationFrame(r); }, [ready]);
  const fitted = useRef(true); // true mientras el usuario no haya hecho zoom/arrastre: se reajusta al cambiar tamaño
  const drag = useRef<{ id: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const pinch = useRef<{ d: number; s: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);

  const grouped = SIDES.map((s) => ({ s, list: matches.filter((m) => m.side === s) })).filter((g) => g.list.length);
  const maxH = mobile ? Infinity : typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.75) : 700;
  const fitScale = natural.w && vw ? Math.max(MIN_SCALE, Math.min(1, (vw - PAD * 2) / natural.w)) : 1;
  // Escala "legible" en móvil: una ronda entera y el principio de la siguiente (invita a deslizar)
  const readable = vw ? Math.max(fitScale, Math.min(1, (vw - PAD * 2) / (BOX_W + COL_GAP + BOX_W * 0.3))) : 1;
  const homeScale = mobile ? readable : fitScale;
  // Altura del lienzo = contenido escalado (sin hueco vacío), con tope en escritorio
  const vh = Math.min(maxH, Math.ceil(natural.h * view.s + PAD * 2));

  /** Limita el desplazamiento: el contenido nunca sale del lienzo. */
  const clamp = useCallback((s: number, x: number, y: number) => {
    const cw = natural.w * s, ch = natural.h * s;
    const availW = vw - PAD * 2, availH = Math.min(maxH, Math.ceil(natural.h * s + PAD * 2)) - PAD * 2;
    const nx = cw <= availW ? 0 : Math.min(0, Math.max(availW - cw, x));
    const ny = ch <= availH ? 0 : Math.min(0, Math.max(availH - ch, y));
    return { s, x: nx, y: ny };
  }, [natural.w, natural.h, vw, maxH]);

  const fit = useCallback(() => { fitted.current = true; setView({ s: homeScale, x: 0, y: 0 }); setReady(true); }, [homeScale]);

  /** Zoom alrededor de un punto (coordenadas relativas al lienzo). */
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    fitted.current = false;
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(fitScale, v.s * factor)); // nunca más pequeño que el encaje
      const cx = (px ?? vw / 2) - PAD, cy = (py ?? vh / 2) - PAD;
      return clamp(s, cx - ((cx - v.x) * s) / v.s, cy - ((cy - v.y) * s) / v.s);
    });
  }, [clamp, fitScale, vw, vh]);

  // Medidas: ancho del lienzo y tamaño natural (sin escalar) del contenido
  useLayoutEffect(() => {
    const vp = viewport.current, ct = content.current;
    if (!vp || !ct) return;
    const measure = () => { setVw(vp.clientWidth); setNatural({ w: ct.offsetWidth, h: ct.offsetHeight }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(ct);
    return () => ro.disconnect();
  }, []);

  // Ajuste automático al cargar y al cambiar tamaño/orientación (si el usuario no ha hecho zoom)
  useLayoutEffect(() => {
    if (!natural.w || !vw) return;
    if (fitted.current) fit();
    else setView((v) => clamp(Math.max(v.s, fitScale), v.x, v.y));
  }, [natural.w, natural.h, vw, mobile]);

  // Rueda: SOLO con Ctrl/⌘ (o pinza del trackpad, que el navegador envía como Ctrl+rueda) hace zoom.
  // Sin Ctrl no se toca nada: el scroll normal desplaza la página. Listener no pasivo para poder cancelar el zoom del navegador.
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    // Pinza táctil: se cancela el gesto nativo solo con dos dedos; un dedo deja hacer scroll vertical de la página
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 2) e.preventDefault(); };
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => { vp.removeEventListener('wheel', onWheel); vp.removeEventListener('touchmove', onTouchMove); };
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,a')) return;
    if (e.pointerType === 'touch') {
      const now = Date.now();
      if (now - lastTap.current < 300) { fit(); lastTap.current = 0; return; }
      lastTap.current = now;
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || pinch.current) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) < 3) return;
    if (e.pointerType !== 'touch') (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fitted.current = false;
    setView((v) => clamp(v.s, d.vx + dx, d.vy + dy));
  };
  const endDrag = () => { drag.current = null; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const r = viewport.current!.getBoundingClientRect();
    pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: view.s, cx: (a.clientX + b.clientX) / 2 - r.left, cy: (a.clientY + b.clientY) / 2 - r.top };
    drag.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = pinch.current;
    if (!p || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const target = (p.s * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) / p.d;
    zoomAt(target / view.s, p.cx, p.cy);
  };
  const onTouchEnd = (e: React.TouchEvent) => { if (e.touches.length < 2) pinch.current = null; };

  const pct = Math.round(view.s * 100);
  return (
    <div data-testid="bracket-horizontal">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-1" role="group" aria-label="Zoom de la llave">
        {!mobile && <span className="num mr-1 text-xs text-muted" aria-live="polite">{pct}%</span>}
        <button type="button" className="btn-ghost h-11 w-11 px-0" onClick={() => zoomAt(1.2)} aria-label="Acercar"><ZoomIn className="h-5 w-5" /></button>
        <button type="button" className="btn-ghost h-11 w-11 px-0" onClick={() => zoomAt(1 / 1.2)} aria-label="Alejar"><ZoomOut className="h-5 w-5" /></button>
        {mobile && view.s > fitScale + 0.01 && fitScale < readable - 0.01
          ? <button type="button" className="btn-secondary h-11 text-sm" onClick={() => { fitted.current = false; setView({ s: fitScale, x: 0, y: 0 }); }}><Maximize2 className="h-4 w-4" aria-hidden />Ver completa</button>
          : <button type="button" className="btn-secondary h-11 text-sm" onClick={fit}><Maximize2 className="h-4 w-4" aria-hidden />{mobile ? 'Tamaño normal' : 'Ajustar a pantalla'}</button>}
      </div>
      <div
        ref={viewport}
        data-testid="bracket-viewport"
        className="tatami-weave relative cursor-grab select-none overflow-hidden rounded-dojo border border-line bg-elevated/40 active:cursor-grabbing"
        style={{ height: vh || undefined, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button,a')) fit(); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div ref={content} data-testid="bracket-content" className="absolute left-0 top-0 w-max origin-top-left will-change-transform"
          style={{ transform: `translate(${PAD + view.x}px, ${PAD + view.y}px) scale(${view.s})`, transition: !smooth || drag.current || pinch.current ? 'none' : 'transform 120ms ease-out', visibility: ready ? 'visible' : 'hidden' }}>
          {grouped.map((g) => <SideBlock key={g.s} title={SIDE[g.s]} matches={g.list} onSelect={onSelect} highlightId={highlightId} />)}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {mobile ? 'Desliza a los lados para ver las rondas · pinza para ampliar · doble toque para ajustar' : 'Arrastra para mover · Ctrl + rueda o pinza para ampliar · doble clic para ajustar'} ·{' '}
        <span className="inline-block h-2 w-2 rounded-full bg-shu align-middle" aria-hidden /> esquina roja ·{' '}
        <span className="inline-block h-2 w-2 rounded-full bg-ai align-middle" aria-hidden /> esquina azul · 🏆 ganador
      </p>
    </div>
  );
}
