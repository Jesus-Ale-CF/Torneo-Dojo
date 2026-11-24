import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de regresión de la interfaz (frontend/e2e).
 * Requieren la app levantada con los datos del seed:
 *   - Docker:  E2E_BASE_URL=http://localhost:8080 npm run test:e2e
 *   - Local:   npm run dev (con el backend) y  npm run test:e2e
 * Las pruebas crean datos con sufijo único y los borran al terminar.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
});
