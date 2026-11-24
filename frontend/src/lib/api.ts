import { backoff, isWakeStatus, markDown, markOk, markWaking, needsWakeBeforeMutation, setHealthCheck, sleep, slowTimer, WAKE_BUDGET_MS } from './serverStatus';

/**
 * Origen del backend. Vacío = mismo origen (Docker con nginx y Vite en desarrollo hacen proxy de /api).
 * En Render el frontend está en otro dominio: VITE_API_URL=https://<backend>.onrender.com
 */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '');
const TOKEN_KEY = 'zenkai-token';
const OFFLINE_MSG = 'No se pudo conectar con el servidor. Lo seguimos intentando; también puedes pulsar Reintentar.';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

const healthUrl = `${API_BASE}/api/health`;
const ping = async () => { try { return (await fetch(healthUrl, { cache: 'no-store' })).ok; } catch { return false; } };
setHealthCheck(ping);

/** Espera a que el servidor responda (GET /api/health, no toca la base de datos) con espera creciente. */
async function wakeServer() {
  const stop = slowTimer();
  const deadline = Date.now() + WAKE_BUDGET_MS;
  try {
    for (let attempt = 0; ; attempt++) {
      if (await ping()) { markOk(); return; }
      markWaking();
      const delay = backoff(attempt);
      if (Date.now() + delay > deadline) { markDown(); throw new ApiError(0, OFFLINE_MSG, 'OFFLINE'); }
      await sleep(delay);
    }
  } finally { stop(); }
}

/**
 * fetch con tolerancia al arranque en frío:
 * - Lecturas (GET/HEAD): se reintentan ante error de red o 502/503/504 con espera creciente durante ~90 s.
 * - Escrituras: si el servidor pudo dormirse, primero se despierta con /api/health; después se envían
 *   una sola vez y solo se reintentan ante 502/503 (el proxy respondió sin que la app procesara nada),
 *   para no duplicar un alta si se perdió la respuesta.
 */
async function send(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const idempotent = method === 'GET' || method === 'HEAD';
  if (!idempotent && needsWakeBeforeMutation()) await wakeServer();
  const stop = slowTimer();
  const deadline = Date.now() + WAKE_BUDGET_MS;
  try {
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      try {
        res = await fetch(url, init);
      } catch (e) {
        if (init.signal?.aborted) throw e;
      }
      if (res && !isWakeStatus(res.status)) { markOk(); return res; }
      const retryable = idempotent || (res !== null && res.status !== 504);
      const delay = backoff(attempt);
      if (!retryable || Date.now() + delay > deadline) {
        markDown();
        if (res) return res;
        throw new ApiError(0, OFFLINE_MSG, 'OFFLINE');
      }
      markWaking();
      await sleep(delay);
    }
  } finally { stop(); }
}

/** Errores en los que tiene sentido reintentar (servidor dormido o sin conexión), no los 4xx */
export const isTransientError = (e: unknown) => e instanceof ApiError && (e.status === 0 || isWakeStatus(e.status));

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await send(`${API_BASE}/api${path}`, { ...init, headers, body });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const e = (data ?? {}) as { message?: string; code?: string; details?: unknown };
    // Respuestas no JSON (ej. proxy caído) → mensaje claro en español
    if (typeof data !== 'object' || data === null) throw new ApiError(res.status, res.status >= 500 ? 'El servidor no responde. Inténtalo de nuevo en unos segundos.' : `Error ${res.status}`);
    if (res.status === 401 && tokenStore.get()) {
      tokenStore.set(null);
      window.dispatchEvent(new Event('zenkai:logout'));
    }
    throw new ApiError(res.status, e.message ?? `Error ${res.status}`, e.code, e.details);
  }
  return data as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const put = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'PUT', json });
export const patch = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

/** URL absoluta para descargas (PDF/Excel) */
export const downloadUrl = (path: string) => `${API_BASE}/api${path}`;

export async function downloadFile(path: string, filename?: string) {
  const headers = new Headers();
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await send(downloadUrl(path), { headers });
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Tu sesión ha caducado: vuelve a iniciar sesión' : 'No se pudo descargar el archivo');
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  const name = filename ?? cd?.match(/filename="?([^"]+)"?/)?.[1] ?? 'archivo';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
