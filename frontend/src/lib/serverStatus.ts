/*
 * Estado de conexión con el backend, pensado para el plan gratuito de Render: el servidor se duerme
 * tras 15 min sin tráfico y tarda hasta ~1 min en despertar. Mientras tanto las peticiones tardan o
 * fallan (red / 502 / 503 / 504). Aquí se decide cuándo mostrar el aviso y cuándo reintentar.
 *
 * - 'ok':     el servidor responde.
 * - 'waking': una petición tarda > 3 s sin respuesta reciente, o falló de forma transitoria: se reintenta.
 * - 'down':   se agotó la espera (~90 s). Se sigue comprobando en segundo plano y, al volver,
 *             se avisa a los suscriptores (`onRecovered`) para recargar los datos.
 */
export type ServerPhase = 'ok' | 'waking' | 'down';

/** Si la última respuesta fue hace menos que esto, una petición lenta es solo lenta (ej. un PDF grande) */
const AWAKE_TTL_MS = 2 * 60_000;
/** Antes de una escritura (POST/PUT…), si no hubo respuesta en este tiempo se despierta primero el servidor */
const MUTATION_WAKE_TTL_MS = 10 * 60_000;
export const SLOW_MS = 3_000;
export const WAKE_BUDGET_MS = 90_000;
const BG_POLL_MS = 15_000;

let phase: ServerPhase = 'ok';
let lastOkAt = 0;
let bgTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const recoveredListeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
function setPhase(p: ServerPhase) {
  if (p === phase) return;
  const wasDown = phase !== 'ok';
  phase = p;
  emit();
  if (p === 'ok' && wasDown) recoveredListeners.forEach((l) => l());
  if (p === 'down') scheduleBackgroundCheck();
}

export const serverStatus = {
  get: () => phase,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Se llama cuando el servidor vuelve a responder tras 'waking' o 'down' */
  onRecovered(l: () => void) { recoveredListeners.add(l); return () => { recoveredListeners.delete(l); }; },
};

export function markOk() { lastOkAt = Date.now(); setPhase('ok'); }
export function markWaking() { if (phase === 'ok') setPhase('waking'); }
export function markDown() { setPhase('down'); }
export const recentlyOk = (ttl = AWAKE_TTL_MS) => Date.now() - lastOkAt < ttl;
export const needsWakeBeforeMutation = () => !recentlyOk(MUTATION_WAKE_TTL_MS);

/** Muestra el aviso si la petición sigue sin respuesta a los 3 s y no hubo respuestas recientes. */
export function slowTimer() {
  const t = setTimeout(() => { if (!recentlyOk()) markWaking(); }, SLOW_MS);
  return () => clearTimeout(t);
}

/** Estado HTTP que da el proxy de Render mientras el servicio arranca (la app no llegó a procesar nada) */
export const isWakeStatus = (status: number) => status === 502 || status === 503 || status === 504;

/** Espera creciente: 1 s, 2 s, 4 s, 8 s… hasta 10 s */
export const backoff = (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let pinger: (() => Promise<boolean>) | null = null;
/** api.ts registra cómo comprobar el servidor (GET /api/health, sin base de datos) */
export function setHealthCheck(fn: () => Promise<boolean>) { pinger = fn; }

function scheduleBackgroundCheck() {
  if (bgTimer || !pinger) return;
  bgTimer = setTimeout(async () => {
    bgTimer = null;
    if (phase !== 'down') return;
    if (pinger && (await pinger())) markOk();
    else scheduleBackgroundCheck();
  }, BG_POLL_MS);
}

/** "Reintentar" manual desde el aviso: comprueba ya en vez de esperar al siguiente ciclo */
export async function retryNow() {
  if (!pinger) return;
  setPhase('waking');
  if (await pinger()) markOk();
  else setPhase('down');
}
