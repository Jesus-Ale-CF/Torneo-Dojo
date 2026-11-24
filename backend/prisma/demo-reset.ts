/*
 * Restablece la demo a su estado inicial: BORRA TODOS LOS DATOS y vuelve a cargar el seed.
 * Protegido: solo funciona con ALLOW_DEMO_RESET=true y exige las credenciales SEED_* reales
 * (nunca restablece la demo con las contraseñas de desarrollo).
 *   ALLOW_DEMO_RESET=true SEED_ADMIN_PASSWORD=… SEED_TABLE_PASSWORD=… npm run seed:demo:reset
 */
if (process.env.ALLOW_DEMO_RESET !== 'true') {
  console.error('⛔ Restablecimiento bloqueado: define ALLOW_DEMO_RESET=true para confirmar que quieres BORRAR todos los datos.');
  process.exit(1);
}

let host = '(desconocido)';
try { const u = new URL(process.env.DATABASE_URL ?? ''); host = u.host + u.pathname; } catch { /* sin URL válida: Prisma fallará con un mensaje claro */ }
console.log(`♻️  Restableciendo la demo en ${host}…`);

process.env.SEED_REQUIRE_ENV = 'true';
await import('./seed.js');
