#!/bin/sh
set -e

echo "[init] Warte auf Datenbank…"
until npx prisma db push --skip-generate --accept-data-loss > /dev/null 2>&1; do
  echo "[init] Datenbank noch nicht bereit, erneuter Versuch in 3s…"
  sleep 3
done

echo "[init] Schema synchronisiert."

echo "[init] Führe Seed aus…"
npx ts-node src/seed.ts

echo "[init] Starte Anwendung…"
exec node dist/main.js
