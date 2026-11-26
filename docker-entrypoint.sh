#!/bin/sh
set -e

# Align bootstrap email with platform super-admin when only SUPER_ADMIN_EMAIL is set
if [ -z "${BOOTSTRAP_ADMIN_EMAIL:-}" ] && [ -n "${SUPER_ADMIN_EMAIL:-}" ]; then
  export BOOTSTRAP_ADMIN_EMAIL="$SUPER_ADMIN_EMAIL"
fi

# Production login needs RSA_PRIVATE_KEY. Persist on qeva-certs volume across restarts.
RSA_KEY_FILE="${RSA_KEY_FILE:-/app/certs/rsa_private.pem}"
if [ -z "${RSA_PRIVATE_KEY:-}" ]; then
  mkdir -p "$(dirname "$RSA_KEY_FILE")"
  if [ ! -f "$RSA_KEY_FILE" ]; then
    echo "> Generating RSA-2048 key ($RSA_KEY_FILE)..."
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$RSA_KEY_FILE"
  fi
  # Export PEM with literal newlines replaced for env-safe single line? Node createPrivateKey accepts multiline.
  RSA_PRIVATE_KEY="$(cat "$RSA_KEY_FILE")"
  export RSA_PRIVATE_KEY
  echo "> RSA private key loaded"
fi

echo "> Waiting for database..."
i=0
until node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.\$queryRaw\`SELECT 1\`.then(()=>p.\$disconnect()).catch(e=>{console.error(e.message);process.exit(1)})" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "> Database not ready after 60s"
    exit 1
  fi
  sleep 2
done
echo "> Database is up"

# shortcut: db push until prisma migrate history is introduced for releases
echo "> Applying schema (prisma db push)..."
npx prisma db push --skip-generate

if [ "${SKIP_BOOTSTRAP_SEED:-}" != "true" ]; then
  echo "> Seeding roles/categories (idempotent)..."
  node scripts/seed-roles.js || true
  node scripts/seed-categories.js || true
  if [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ] || [ -n "${SUPER_ADMIN_EMAIL:-}" ]; then
    echo "> Ensuring bootstrap admin..."
    node scripts/seed-admin.js || true
  fi
fi

echo "> Starting Qeva..."
exec "$@"
