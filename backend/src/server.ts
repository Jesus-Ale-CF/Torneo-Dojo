import { buildApp } from './app.js';
import { env } from './lib/env.js';

const app = await buildApp();
try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Zenkai Dojo API escuchando en http://${env.HOST}:${env.PORT} — docs en /docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
