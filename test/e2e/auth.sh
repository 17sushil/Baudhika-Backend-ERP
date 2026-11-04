#!/usr/bin/env bash
# Control plane + school authentication, users and isolation. Sourced by run.sh (shares variables with people.sh).
# Leaves for later suites: PT (platform token), AT (school principal token = top role, tenant e2eschool), TOP_ID.

echo "== auth suite"
TODAY=$(TZ=Asia/Kathmandu date +%F)

# ---------------------------------------------------------------- app
TEN=
reqs "GET /" GET / ""; check "GET / envelope" "$(d '.message'):$(d '.statusCode')" "success:200"
reqs "GET /health" GET /health ""; check "health" "$(d .data.database)" up

# ---------------------------------------------------------------- platform auth
reqs "POST /platform/auth/login" POST /platform/auth/login "" '{"email":"e2e@platform.test","password":"E2e-Platform-Pass1"}'
CH=$(d .data.challengeId); check "platform login -> OTP challenge" "$ST:${#CH}" "200:36"
reqs "POST /platform/auth/login :: wrong password" POST /platform/auth/login "" '{"email":"e2e@platform.test","password":"nope"}'
check "platform wrong password" "$ST" 401
reqs "POST /platform/auth/verify-otp" POST /platform/auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"$(otp e2e@platform.test)\"}"
PT=$(d .data.accessToken); PRT=$(d .data.refreshToken); check "platform verify-otp" "$ST:$(d .data.tokenType)" "200:Bearer"
reqs "POST /platform/auth/refresh" POST /platform/auth/refresh "" "{\"refreshToken\":\"$PRT\"}"
PT=$(d .data.accessToken); PRT=$(d .data.refreshToken); check "platform refresh rotates" "$ST" 200

# ---------------------------------------------------------------- tenants
for s in e2eschool e2eother; do
  reqs "POST /tenants" POST /tenants "$PT" "{\"name\":\"School $s\",\"slug\":\"$s\",\"principalEmail\":\"principal@$s.test\",\"principalPassword\":\"Initial-Principal-Pass1\"}"
  check "provision $s" "$ST:$(d .data.status)" "201:active"
  echo "$B" | grep -qiE 'password|db_' && check "tenant view leaks secrets" leak none
done
reqs "POST /tenants :: duplicate slug" POST /tenants "$PT" '{"name":"Dup School","slug":"e2eschool","principalEmail":"a@b.co","principalPassword":"Initial-Principal-Pass1"}'
check "duplicate slug" "$ST" 409
reqs "POST /tenants :: validation error" POST /tenants "$PT" '{"name":"X","slug":"Bad Slug!"}'; check "tenant validation" "$ST" 400
req GET /tenants ""; check "tenants need platform token" "$ST" 401
reqs "GET /tenants" GET /tenants "$PT"; check "list tenants" "$(d '.data|length')" 2
TEN_ID=$(d '.data[]|select(.slug=="e2eschool").id')
reqs "PUT /tenants/{id}/branding" PUT /tenants/$TEN_ID/branding "$PT" '{"displayName":"E2E School","shortName":"E2E","primaryColor":"#1d4ed8","logoUrl":"https://cdn.example.com/logo.png"}'
check "publish branding" "$(d .data.theme.primary)" "#1D4ED8"
req PUT /tenants/$TEN_ID/branding "$PT" '{"displayName":"E2E","logoUrl":"http://x.com/a.png"}'; check "branding rejects http logo" "$ST" 400
reqs "GET /public/tenants/resolve" GET "/public/tenants/resolve?host=e2eschool.localhost" ""; check "public resolve" "$(d .data.name)" "E2E School"
req GET "/public/tenants/resolve?host=nope.localhost" ""; check "resolve unknown" "$ST" 404

# ---------------------------------------------------------------- school principal (first account): OTP + forced password change
TEN=e2eschool
reqs "POST /auth/login :: otp required" POST /auth/login "" '{"identifier":"PRINCIPAL@e2eschool.test","password":"Initial-Principal-Pass1"}'
check "principal login needs OTP (email case-insensitive)" "$(d .data.status)" otp_required; CH=$(d .data.challengeId)
reqs "POST /auth/verify-otp :: wrong code" POST /auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"000000\"}"; check "wrong OTP" "$ST" 401
reqs "POST /auth/verify-otp" POST /auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"$(otp principal@e2eschool.test)\"}"
AT=$(d .data.accessToken); check "verify-otp -> must change password" "$(d .data.mustChangePassword)" true
req POST /auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"$(otp principal@e2eschool.test)\"}"; check "OTP single use" "$ST" 401
reqs "GET /users :: password change pending" GET /users "$AT"; check "blocked until password change" "$(d .code)" PASSWORD_CHANGE_REQUIRED
req GET /auth/me "$AT"; check "/auth/me allowed while pending" "$ST" 200
reqs "POST /auth/change-password :: weak password" POST /auth/change-password "$AT" '{"currentPassword":"Initial-Principal-Pass1","newPassword":"short"}'
check "weak password" "$ST" 400
OLD=$AT
reqs "POST /auth/change-password" POST /auth/change-password "$AT" '{"currentPassword":"Initial-Principal-Pass1","newPassword":"PrincipalPass123"}'
AT=$(d .data.accessToken); check "change password" "$ST" 200
req GET /auth/me "$OLD"; check "old session revoked" "$ST" 401
reqs "GET /auth/me" GET /auth/me "$AT"; TOP_ID=$(d .data.id)
check "/auth/me roles" "$(d '.data.roles[0].code'):$(d '.data.roles[0].scopeType')" "principal:institution"

# ---------------------------------------------------------------- users
reqs "POST /users" POST /users "$AT" '{"username":"ram.teacher","phone":"984-100-0000","password":"Teacher123","roles":["teacher"],"mustChangePassword":false}'
TID=$(d .data.id); check "create user (phone normalized)" "$ST:$(d .data.phone)" "201:9841000000"
echo "$B" | grep -qi hash && check "user leaks hash" leak none
reqs "POST /users :: duplicate" POST /users "$AT" '{"username":"RAM.TEACHER","password":"Teacher123"}'; check "duplicate username" "$ST" 409
req POST /users "$AT" '{"username":"x.y","password":"Teacher123","roles":["superadmin"]}'; check "unknown role" "$ST" 400
req POST /users "$AT" '{"password":"Teacher123"}'; check "no identifier" "$ST" 400
req POST /users "$AT" '{"username":"a.b","password":"Teacher123","status":"active"}'; check "unknown field rejected" "$ST" 400
reqs "GET /users" GET "/users?search=ram&page=1&limit=20" "$AT"; check "list users" "$(d .data.total)" 1
req GET "/users?search=%25" "$AT"; check "LIKE wildcard escaped" "$(d .data.total)" 0
reqs "GET /users/{id}" GET /users/$TID "$AT"; check "get user" "$(d .data.username)" ram.teacher
req GET /users/not-a-uuid "$AT"; check "malformed id" "$ST" 400
reqs "POST /users/{id}/roles" POST /users/$TID/roles "$AT" '{"role":"accountant","validTo":"2099-12-31"}'
ACC_ASSIGN=$(d '.data.roles[]|select(.code=="accountant").assignmentId'); check "assign role" "$ST:$(d '.data.roles|length')" "200:2"
reqs "DELETE /users/{id}/roles/{assignmentId}" DELETE /users/$TID/roles/$ACC_ASSIGN "$AT"; check "revoke role" "$ST:$(d '.data.roles|length')" "200:1"
TOP_ASSIGN=$(req GET /auth/me "$AT"; d '.data.roles[0].assignmentId')
reqs "DELETE /users/{id}/roles/{assignmentId} :: last principal" DELETE /users/$TOP_ID/roles/$TOP_ASSIGN "$AT"; check "last principal protected" "$ST" 409

reqs "POST /auth/login" POST /auth/login "" '{"identifier":"9841000000","password":"Teacher123"}'
TT=$(d .data.accessToken); TRT=$(d .data.refreshToken); check "teacher login by phone, no OTP" "$(d .data.status)" authenticated
reqs "GET /users :: missing permission" GET /users "$TT"; check "teacher lacks user.read" "$ST" 403

# ---------------------------------------------------------------- isolation
TEN=e2eother; req GET /auth/me "$AT"; check "token bound to its school" "$ST" 401
req POST /auth/refresh "" "{\"refreshToken\":\"$TRT\"}"; check "refresh token useless at other school" "$ST" 401
req POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher123"}'; check "user unknown at other school" "$ST" 401
TEN=e2eschool; req GET /auth/me "$PT"; check "platform token on school route" "$ST" 401
TEN=; req GET /tenants "$AT"; check "school token on platform route" "$ST" 401
reqs "POST /auth/login :: missing x-tenant-id" POST /auth/login "" '{"identifier":"a.b.c","password":"x"}'; check "missing tenant header" "$ST" 404
TEN=e2eschool

# ---------------------------------------------------------------- sessions
reqs "POST /auth/refresh" POST /auth/refresh "" "{\"refreshToken\":\"$TRT\"}"; TRT2=$(d .data.refreshToken); TT2=$(d .data.accessToken)
check "refresh rotates" "$ST" 200
req POST /auth/refresh "" "{\"refreshToken\":\"$TRT\"}"; check "reused refresh token rejected" "$ST" 401
req GET /auth/me "$TT2"; check "reuse revokes the whole session" "$ST" 401
req POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher123"}'; LAT=$(d .data.accessToken); LRT=$(d .data.refreshToken)
reqs "POST /auth/logout" POST /auth/logout "" "{\"refreshToken\":\"$LRT\"}"; check "logout" "$ST" 204
req GET /auth/me "$LAT"; check "token dead after logout" "$ST" 401
req POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher123"}'; TT=$(d .data.accessToken)
reqs "PATCH /users/{id}/status" PATCH /users/$TID/status "$AT" '{"status":"suspended"}'; check "suspend user" "$(d .data.status)" suspended
req GET /auth/me "$TT"; check "suspended user's token dead" "$ST" 401
reqs "POST /auth/login :: account not active" POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher123"}'; check "suspended login" "$ST" 403
req PATCH /users/$TOP_ID/status "$AT" '{"status":"suspended"}'; check "cannot suspend self" "$ST" 400
req PATCH /users/$TID/status "$AT" '{"status":"active"}'

# ---------------------------------------------------------------- lockout + rate limit (own client IPs)
IP=198.51.100.21
for _ in 1 2 3 4 5; do req POST /auth/login "" '{"identifier":"ram.teacher","password":"WrongPass1"}'; done
reqs "POST /auth/login :: wrong password" POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher123"}'
check "locked after 5 failures (even correct password)" "$ST" 401
reqs "POST /users/{id}/reset-password" POST /users/$TID/reset-password "$AT" '{"password":"Teacher456"}'
check "reset unlocks" "$ST:$(d .data.lockedUntil)" "200:null"
req POST /auth/login "" '{"identifier":"ram.teacher","password":"Teacher456"}'; check "after reset: must change password" "$(d .data.mustChangePassword)" true
IP=198.51.100.22
for _ in $(seq 1 10); do req POST /auth/login "" '{"identifier":"nobody.here","password":"x"}'; done
reqs "POST /auth/login :: rate limited" POST /auth/login "" '{"identifier":"nobody.here","password":"x"}'; check "login rate limited" "$ST" 429
IP=198.51.100.10

TEN=; reqs "POST /platform/auth/logout" POST /platform/auth/logout "" "{\"refreshToken\":\"$PRT\"}"; check "platform logout" "$ST" 204
req GET /tenants "$PT"; check "platform token dead after logout" "$ST" 401
TEN=e2eschool
