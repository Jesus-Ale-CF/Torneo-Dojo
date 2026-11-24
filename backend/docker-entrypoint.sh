#!/bin/sh
set -e
echo "⏳ Aplicando migraciones…"
npx prisma migrate deploy
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/prisma/seed-if-empty.js
fi
echo "🥋 Iniciando Zenkai Dojo API"
exec node dist/src/server.js
