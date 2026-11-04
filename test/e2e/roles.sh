#!/usr/bin/env bash
# Role management and the role hierarchy. Sourced by run.sh after people.sh (uses AT = school principal token = top role).

echo "== roles suite"
TEN=e2eschool

reqs "GET /permissions" GET /permissions "$AT"; PERM_COUNT=$(d '.data|length')
check "permission catalogue" "$ST:$([ "$PERM_COUNT" -ge 30 ] && echo ok)" "200:ok"
reqs "GET /roles" GET /roles "$AT"
TOP_ROLE=$(d '.data[]|select(.code=="principal").id'); ADMIN_ROLE=$(d '.data[]|select(.code=="admin").id')
check "principal holds every permission" "$(d '.data[]|select(.code=="principal").permissions|length')" "$PERM_COUNT"
check "admin holds everything except role.manage" "$(d '.data[]|select(.code=="admin").permissions|length'):$(d '.data[]|select(.code=="admin").permissions|index("role.manage")')" "$((PERM_COUNT - 1)):null"
check "principal can manage every role" "$(d '[.data[]|select(.manageable|not)]|length')" 0
check "hierarchy order: principal, then admin" "$(d '.data[0].code'),$(d '.data[1].code')" "principal,admin"
reqs "GET /roles/{id}" GET /roles/$ADMIN_ROLE "$AT"; check "get role" "$(d .data.code):$(d .data.isSystem):$(d .data.requiresMfa)" "admin:true:true"

# ---- custom role lifecycle
reqs "POST /roles" POST /roles "$AT" '{"code":"librarian","name":"Librarian","permissions":["org.read","student.read"]}'
LIB=$(d .data.id); check "create custom role" "$ST:$(d '.data.permissions|join(",")'):$(d .data.isSystem)" "201:org.read,student.read:false"
reqs "POST /roles :: duplicate code" POST /roles "$AT" '{"code":"librarian","name":"Again","permissions":[]}'; check "duplicate role code" "$ST" 409
req POST /roles "$AT" '{"code":"principal","name":"Fake principal","permissions":[]}'; check "cannot recreate system code" "$ST" 409
reqs "POST /roles :: unknown permission" POST /roles "$AT" '{"code":"x_role","name":"X","permissions":["student.fly"]}'; check "unknown permission" "$ST" 400
req POST /roles "$AT" '{"code":"Bad Code","name":"X","permissions":[]}'; check "invalid role code" "$ST" 400

req POST /users "$AT" '{"username":"lib.user","password":"LibPass123","roles":["librarian"],"mustChangePassword":false}'; LIBU=$(d .data.id)
IP=198.51.100.41
req POST /auth/login "" '{"identifier":"lib.user","password":"LibPass123"}'; LT=$(d .data.accessToken)
req GET /students "$LT"; check "custom role grants student.read" "$ST" 200
req GET /staff "$LT"; check "custom role lacks staff.read" "$ST" 403
reqs "PATCH /roles/{id}" PATCH /roles/$LIB "$AT" '{"name":"Head Librarian","permissions":["org.read","student.read","staff.read"]}'
check "edit role permissions" "$(d .data.name):$(d '.data.permissions|length')" "Head Librarian:3"
req GET /staff "$LT"; check "permission change applies immediately" "$ST" 200
reqs "DELETE /roles/{id} :: still assigned" DELETE /roles/$LIB "$AT"; check "cannot delete assigned role" "$ST" 409

# ---- the principal is locked at the top
reqs "PATCH /roles/{id} :: principal permissions locked" PATCH /roles/$TOP_ROLE "$AT" '{"permissions":["org.read"]}'; check "principal permissions locked" "$ST" 400
req PATCH /roles/$TOP_ROLE "$AT" '{"requiresMfa":false}'; check "principal OTP locked" "$ST" 400
req PATCH /roles/$TOP_ROLE "$AT" '{"name":"Principal / Head"}'; check "principal can be renamed" "$ST:$(d .data.name)" "200:Principal / Head"
reqs "DELETE /roles/{id} :: built-in role" DELETE /roles/$TOP_ROLE "$AT"; check "built-in role cannot be deleted" "$ST" 400
req DELETE /roles/$ADMIN_ROLE "$AT"; check "admin role cannot be deleted either" "$ST" 400

# ---- admin: everything except role design (and therefore can't grant principal)
req POST /users "$AT" '{"username":"school.admin","email":"school.admin@e2eschool.test","password":"SchoolAdmin1","roles":["admin"],"mustChangePassword":false}'
SA=$(d .data.id); check "principal creates an admin" "$ST" 201
IP=198.51.100.42
req POST /auth/login "" '{"identifier":"school.admin","password":"SchoolAdmin1"}'; check "admin needs OTP" "$(d .data.status)" otp_required; CH=$(d .data.challengeId)
req POST /auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"$(otp school.admin@e2eschool.test)\"}"; SAT=$(d .data.accessToken)
req GET /roles "$SAT"; check "admin can view roles; principal not manageable" "$ST:$(d '.data[]|select(.code=="principal").manageable')" "200:false"
req POST /roles "$SAT" '{"code":"clerk","name":"Clerk","permissions":["org.read"]}'; check "admin cannot create roles" "$ST" 403
req PATCH /roles/$ADMIN_ROLE "$SAT" '{"name":"Hacked"}'; check "admin cannot edit roles" "$ST" 403
req POST /users "$SAT" '{"username":"new.teacher","password":"Teacher123","roles":["teacher"]}'; NT=$(d .data.id); check "admin creates logins with lower roles" "$ST" 201
req POST /users/$NT/roles "$SAT" '{"role":"principal"}'; check "admin cannot grant principal" "$ST" 403
req POST /users/$NT/roles "$SAT" '{"role":"accountant"}'; check "admin grants roles below principal" "$ST" 200
req POST /campuses "$SAT" '{"code":"ADM","name":"Admin-made branch"}'; check "admin manages organization" "$ST" 201
req GET /audit-logs "$SAT"; check "admin reads audit" "$ST" 200
TOP_ASSIGN=$(req GET /auth/me "$AT"; d '.data.roles[]|select(.code=="principal").assignmentId')
req DELETE /users/$TOP_ID/roles/$TOP_ASSIGN "$SAT"; check "admin cannot revoke principal" "$ST" 403
req PATCH /users/$TOP_ID/status "$SAT" '{"status":"suspended"}'; check "admin cannot suspend principal" "$ST" 403
IP=198.51.100.10

# ---- a role manager below admin (role.read + role.manage + role.assign + user.read + student.read)
req POST /roles "$AT" '{"code":"role_officer","name":"Role Officer","permissions":["role.read","role.manage","role.assign","user.read","student.read"]}'
req POST /users "$AT" '{"username":"role.officer","password":"RolePass123","roles":["role_officer"],"mustChangePassword":false}'; RO=$(d .data.id)
req POST /auth/login "" '{"identifier":"role.officer","password":"RolePass123"}'; OT=$(d .data.accessToken)
req GET /roles "$OT"; check "officer sees principal and admin as not manageable" "$(d '.data[]|select(.code=="principal").manageable'),$(d '.data[]|select(.code=="admin").manageable')" "false,false"
reqs "POST /roles :: permission you do not hold" POST /roles "$OT" '{"code":"sneaky","name":"Sneaky","permissions":["staff.delete"]}'; check "cannot grant what you lack" "$ST" 403
req POST /roles "$OT" '{"code":"reader","name":"Reader","permissions":["student.read"]}'; READER=$(d .data.id); check "officer creates role within own permissions" "$ST" 201
req PATCH /roles/$ADMIN_ROLE "$OT" '{"name":"Hacked"}'; check "cannot edit a role above you" "$ST" 403
req PATCH /roles/$TOP_ROLE "$OT" '{"name":"Hacked"}'; check "cannot edit principal" "$ST" 403
req PATCH /roles/$READER "$OT" '{"permissions":["student.read","audit.read"]}'; check "cannot add permission you lack" "$ST" 403
req POST /users/$LIBU/roles "$OT" '{"role":"admin"}'; check "cannot assign admin" "$ST" 403
req POST /users/$LIBU/roles "$OT" '{"role":"principal"}'; check "cannot assign principal" "$ST" 403
req POST /users/$LIBU/roles "$OT" '{"role":"reader"}'; check "can assign role within own permissions" "$ST" 200
req DELETE /users/$TOP_ID/roles/$TOP_ASSIGN "$OT"; check "cannot revoke principal's role" "$ST" 403
req DELETE /roles/$READER "$OT"; check "role still assigned" "$ST" 409
IP=198.51.100.10

# ---- cleanup through the API
LIB_ASSIGN=$(req GET /users/$LIBU "$AT"; d '.data.roles[]|select(.code=="librarian").assignmentId')
req DELETE /users/$LIBU/roles/$LIB_ASSIGN "$AT"
reqs "DELETE /roles/{id}" DELETE /roles/$LIB "$AT"; check "delete unassigned custom role" "$ST" 204
req GET /roles/$LIB "$AT"; check "deleted role gone" "$ST" 404
req GET "/audit-logs?tableName=roles&recordId=$LIB" "$AT"; check "role changes audited" "$(d '[.data.items[].action]|sort|join(",")')" "delete,insert,update"
