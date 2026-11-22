#!/usr/bin/env sh
# Backend container entrypoint: sync the schema, then start the API.
#
# `prisma db push` runs on every boot (see CLAUDE.md, "Deployment runs prisma
# db push"). It used to run with `--accept-data-loss`, which meant any boot —
# including an unattended restart by Coolify's auto-update at 04:00 — would
# silently DROP whatever columns or tables the schema no longer declared.
#
# Now the default is safe:
#   - Additive changes (new tables, new nullable columns) apply as before.
#   - A change that would lose data is REFUSED. The database is left exactly as
#     it was, a loud error is printed, and the API still starts so the site
#     stays up.
#
# To deliberately apply a destructive change, for ONE deploy:
#   1. Preview it:  docker exec <backend> sh -c 'cd /app/apps/backend && sh scripts/preview-schema-changes.sh'
#   2. Set PRISMA_ACCEPT_DATA_LOSS=true in Coolify and redeploy.
#   3. Remove the variable again straight after.

set -u

cd /app/packages/db || exit 1

if [ "${PRISMA_ACCEPT_DATA_LOSS:-}" = "true" ]; then
  echo "WARN  PRISMA_ACCEPT_DATA_LOSS=true — db push may DROP columns/tables. Unset it after this deploy."
  npx prisma db push --skip-generate --accept-data-loss || {
    echo "ERROR prisma db push failed — starting the API on the existing schema."
  }
else
  if ! npx prisma db push --skip-generate; then
    echo "ERROR ================================================================"
    echo "ERROR prisma db push REFUSED to change the schema: the change would lose data."
    echo "ERROR Nothing was dropped. The database is unchanged."
    echo "ERROR The API is starting on the existing schema; new columns from this"
    echo "ERROR release are NOT applied yet, so features using them may fail."
    echo "ERROR To review:  sh scripts/preview-schema-changes.sh  (inside this container)"
    echo "ERROR To apply:   set PRISMA_ACCEPT_DATA_LOSS=true, redeploy, then unset it."
    echo "ERROR ================================================================"
  fi
fi

cd /app || exit 1
exec node apps/backend/dist/index.js
