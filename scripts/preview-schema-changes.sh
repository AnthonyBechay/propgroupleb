#!/usr/bin/env sh
# Show exactly what `prisma db push` would do to the database — without doing it.
#
# `db push --accept-data-loss` drops anything the schema no longer has. That is
# usually intended, but on production you want to read the list first. This
# prints the SQL and changes nothing.
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
