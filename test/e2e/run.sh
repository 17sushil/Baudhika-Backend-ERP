#!/usr/bin/env bash
# API end-to-end tests against a real server and real Postgres, fully isolated from your data.
#
#   npm run test:e2e                      # build, run every suite, clean up
#   E2E_DOCS_DIR=out npm run test:e2e     # also save openapi.json + request/response samples (API docs input)
#
# Creates and always drops: database erp_e2e_master, tenant databases/roles tenant_e2eschool and
# tenant_e2eother (names used only by this suite). Needs: psql, curl, jq, Postgres with postgresql-contrib,
# DB_HOST/DB_USER/DB_PASS in .env (a role with CREATEDB + CREATEROLE). Port: E2E_PORT (default 4100).
set -uo pipefail
cd "$(dirname "$0")/../.."

for bin in psql curl jq node; do command -v "$bin" >/dev/null || { echo "missing dependency: $bin"; exit 2; }; done

# Read only the DB connection settings from .env (no shell evaluation of the file).
envval() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
export PGHOST=${DB_HOST:-$(envval DB_HOST)} PGPORT=${DB_PORT:-$(envval DB_PORT)} PGUSER=${DB_USER:-$(envval DB_USER)} PGPASSWORD=${DB_PASS:-$(envval DB_PASS)}
PGPORT=${PGPORT:-5432}

PORT=${E2E_PORT:-4100}
MASTER=erp_e2e_master
TENANT_DBS=(tenant_e2eschool tenant_e2eother)
WORK=$(mktemp -d)
export API="http://localhost:$PORT" LOG="$WORK/server.log" SAMPLES=""
[ -n "${E2E_DOCS_DIR:-}" ] && { mkdir -p "$E2E_DOCS_DIR"; SAMPLES="$(cd "$E2E_DOCS_DIR" && pwd)/samples.jsonl"; : > "$SAMPLES"; }
SERVER_PID=

drop_all() {
  for db in "${TENANT_DBS[@]}" "$MASTER"; do psql -d postgres -qc "DROP DATABASE IF EXISTS $db WITH (FORCE)" 2>/dev/null; done
  for db in "${TENANT_DBS[@]}"; do psql -d postgres -qc "DROP ROLE IF EXISTS $db" 2>/dev/null; done
}
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null
  drop_all
  rm -rf .e2e-dist "$WORK"
}
trap cleanup EXIT

if curl -s -o /dev/null "localhost:$PORT"; then echo "port $PORT is busy; set E2E_PORT"; exit 2; fi
psql -d postgres -Atc 'select 1' >/dev/null || { echo "cannot connect to Postgres with the .env DB_* settings"; exit 2; }

echo "== setup: scratch databases"
drop_all
psql -d postgres -qc "CREATE DATABASE $MASTER" || exit 2
MASTER_DB_NAME=$MASTER npm run -s migration:master:run >"$WORK/migrate.log" 2>&1 || { cat "$WORK/migrate.log"; exit 2; }
MASTER_DB_NAME=$MASTER SEED_ADMIN_EMAIL=e2e@platform.test SEED_ADMIN_PASSWORD=E2e-Platform-Pass1 SEED_ADMIN_NAME=E2E \
  npm run -s seed:platform-admin >/dev/null 2>&1 || { echo "seeding platform admin failed"; exit 2; }

echo "== setup: build (Nest CLI, Swagger plugin)"
npx nest build -p test/e2e/tsconfig.e2e.json >"$WORK/build.log" 2>&1 || { cat "$WORK/build.log"; exit 2; }

echo "== setup: server on :$PORT"
# TRUST_PROXY=1 lets each test section use its own X-Forwarded-For client IP (separate rate-limit buckets).
MASTER_DB_NAME=$MASTER PORT=$PORT TRUST_PROXY=1 MAIL_DRIVER=console SWAGGER_ENABLED=true NODE_ENV=test \
  node .e2e-dist/main.js >"$LOG" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do curl -s -o /dev/null "$API/health" && break; sleep 0.5; done
curl -s -o /dev/null "$API/health" || { echo "server did not start"; cat "$LOG"; exit 2; }

PASS=0; FAIL=0
# shellcheck source=/dev/null
source test/e2e/lib.sh
source test/e2e/auth.sh
source test/e2e/people.sh
source test/e2e/roles.sh
source test/e2e/dashboard.sh

ERRORS=$(grep -c ' ERROR ' "$LOG" || true)
if [ -n "${E2E_DOCS_DIR:-}" ]; then curl -s "$API/docs-json" > "$E2E_DOCS_DIR/openapi.json"; echo "docs input saved to $E2E_DOCS_DIR"; fi
[ "$ERRORS" != "0" ] && { echo "server logged $ERRORS error(s):"; grep -A5 ' ERROR ' "$LOG" | head -40; }

echo
echo "RESULT: $PASS passed, $FAIL failed, $ERRORS server errors"
[ "$FAIL" = "0" ] && [ "$ERRORS" = "0" ]
