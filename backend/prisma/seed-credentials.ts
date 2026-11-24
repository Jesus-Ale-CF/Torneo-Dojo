/*
 * Credenciales de los usuarios del seed.
 * - Desarrollo local: valores por defecto conocidos (admin123 / mesa123).
 * - Producción (NODE_ENV=production) o restablecimiento de la demo (SEED_REQUIRE_ENV=true):
 *   SEED_ADMIN_PASSWORD y SEED_TABLE_PASSWORD son obligatorias; nunca se usan las de desarrollo.
 */
export interface SeedCredentials {
  adminEmail: string;
  adminPassword: string;
  tablePassword: string;
  /** true = vienen de variables de entorno (no se imprimen en los logs) */
  fromEnv: boolean;
}

const DEV = { adminEmail: 'admin@zenkai.dojo', adminPassword: 'admin123', tablePassword: 'mesa123' };
const MIN_LENGTH = 6;

export function seedCredentials(source: NodeJS.ProcessEnv = process.env): SeedCredentials {
  const strict = source.NODE_ENV === 'production' || source.SEED_REQUIRE_ENV === 'true';
  const adminEmail = source.SEED_ADMIN_EMAIL?.trim().toLowerCase() || DEV.adminEmail;
  const adminPassword = source.SEED_ADMIN_PASSWORD ?? '';
  const tablePassword = source.SEED_TABLE_PASSWORD ?? '';

  if (!strict) {
    return { adminEmail, adminPassword: adminPassword || DEV.adminPassword, tablePassword: tablePassword || DEV.tablePassword, fromEnv: !!(adminPassword || tablePassword) };
  }
  const missing = [
    !adminPassword && 'SEED_ADMIN_PASSWORD',
    !tablePassword && 'SEED_TABLE_PASSWORD',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Faltan variables para el seed de demo: ${missing.join(', ')}. No se usan las contraseñas de desarrollo en producción.`);
  if (adminPassword.length < MIN_LENGTH || tablePassword.length < MIN_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD y SEED_TABLE_PASSWORD deben tener al menos ${MIN_LENGTH} caracteres.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error(`SEED_ADMIN_EMAIL no es un correo válido: "${adminEmail}"`);
  return { adminEmail, adminPassword, tablePassword, fromEnv: true };
}
