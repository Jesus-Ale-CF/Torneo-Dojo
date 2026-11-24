/*
 * Ejecuta el seed de demo solo si la base de datos está vacía (sin usuarios).
 * Se usa al arrancar en Docker y en Render: nunca borra datos existentes.
 * SEED_ON_START=false lo desactiva.
 */
import { prisma } from '../src/lib/prisma.js';

if (process.env.SEED_ON_START === 'false') {
  console.log('ℹ️  SEED_ON_START=false: se omite el seed.');
  await prisma.$disconnect();
} else {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`ℹ️  Base de datos con ${users} usuario(s): se omite el seed.`);
    await prisma.$disconnect();
  } else {
    console.log('🌱 Base de datos vacía: cargando datos de prueba…');
    await prisma.$disconnect();
    await import('./seed.js');
  }
}
