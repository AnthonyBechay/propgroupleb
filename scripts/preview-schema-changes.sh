#!/usr/bin/env sh
# Show exactly what `prisma db push` would do to the database — without doing it.
#
# Boot runs `db push` WITHOUT --accept-data-loss, so a destructive change is
# refused (see scripts/boot-backend.sh). Run this to read exactly what would be
# dropped before setting PRISMA_ACCEPT_DATA_LOSS=true for one deploy. It prints
# the SQL and changes nothing.
#
#   docker exec $BE sh -c 'cd /app/apps/backend && sh scripts/preview-schema-changes.sh'

cd "$(dirname "$0")/../../../packages/db" 2>/dev/null || cd packages/db || exit 1

echo "── SQL that db push would run ───────────────────────────────────────"
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

echo ""
echo "── Anything above that says DROP is data that goes away. ────────────"
