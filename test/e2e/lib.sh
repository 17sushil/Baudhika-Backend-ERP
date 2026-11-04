#!/usr/bin/env bash
# Shared helpers for the API end-to-end suites. Sourced by run.sh's suites; needs curl + jq.
#   API       base URL of the test server
#   LOG       server log file (OTP codes are read from it; MAIL_DRIVER=console)
#   SAMPLES   optional JSONL file: reqs() appends request/response samples for the API docs
#   TEN       x-tenant-id for school routes (empty for platform routes)
#   IP        client IP sent as X-Forwarded-For (server runs with TRUST_PROXY=1), so rate-limit buckets
#             can be separated per test section instead of sleeping

PASS=${PASS:-0}; FAIL=${FAIL:-0}; IP=${IP:-198.51.100.10}
J='Content-Type: application/json'

otp() { sleep 0.4; grep "OTP for $1:" "$LOG" | tail -1 | sed -E 's/.*: ([0-9]{6}) .*/\1/'; }

check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS + 1))
  else FAIL=$((FAIL + 1)); echo "FAIL  $1 (got '$2', want '$3')"; [ -n "$B" ] && echo "      body: $(echo "$B" | head -c 400)"; fi
}

# req METHOD PATH TOKEN [BODY]  -> ST = HTTP status, B = body
req() {
  local m=$1 p=$2 t=${3:-} d=${4:-} tmp; tmp=$(mktemp)
  ST=$(curl -s -o "$tmp" -w '%{http_code}' -X "$m" "$API$p" -H "$J" -H "X-Forwarded-For: $IP" \
    ${TEN:+-H "x-tenant-id: $TEN"} ${t:+-H "Authorization: Bearer $t"} ${d:+-d "$d"})
  B=$(cat "$tmp"); rm -f "$tmp"
}

# reqs "METHOD /openapi/{path}[ :: variant]" METHOD PATH TOKEN [BODY]  -> req + record a docs sample
reqs() {
  local label=$1; shift
  req "$@"
  [ -z "${SAMPLES:-}" ] && return 0
  local body=${4:-null}
  jq -cn --arg label "$label" --arg tenant "$TEN" --argjson auth "$([ -n "${3:-}" ] && echo true || echo false)" \
    --argjson status "$ST" --argjson req "$(echo "$body" | jq -c . 2>/dev/null || echo null)" \
    --argjson res "$(echo "${B:-null}" | jq -c . 2>/dev/null || echo null)" \
    '{label: $label, tenant: $tenant, auth: $auth, status: $status, request: $req, response: $res}' >> "$SAMPLES"
}

d() { echo "$B" | jq -r "$1"; }
