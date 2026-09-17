#!/bin/sh
set -e

echo ">> [1/3] Menerapkan skema database..."
npx prisma db push --accept-data-loss --skip-generate

echo ">> [2/3] Memastikan akun login tersedia..."
npx tsx prisma/seed-login.ts || echo "   (seed login dilewati — set SEED_EMAIL/SEED_PASSWORD bila perlu)"

echo ">> [3/3] Menjalankan PPMS di port ${PORT:-3088}..."
exec npx next start -p "${PORT:-3088}"
