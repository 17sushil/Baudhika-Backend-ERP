#!/usr/bin/env bash
# KPIs + security regressions (audit redaction, account-admin audit). Sourced by run.sh after roles.sh.
# Data at this point: students RAM (MAIN, active, male) + KIRAN (COLLEGE, applicant, male);
# staff GITA (MAIN, teaching, active) + BIR (MAIN, driver, active).

echo "== dashboard + security suite"
TEN=e2eschool

reqs "GET /dashboard/kpis" GET /dashboard/kpis "$AT"
check "principal: institution scope" "$ST:$(d .data.scope)" "200:institution"
check "students: enrolled/applicants/total" "$(d .data.students.enrolled)/$(d .data.students.applicants)/$(d .data.students.total)" "1/1/2"
check "students by status + gender" "$(d .data.students.byStatus.active):$(d .data.students.byStatus.alumni):$(d .data.students.byGender.male)" "1:0:1"
check "admissions this month" "$(d .data.students.admissionsThisMonth)" 2
check "students by campus" "$(d '[.data.students.byCampus[]|"\(.code)=\(.current)/\(.total)"]|sort|join(",")')" "COLLEGE=0/1,MAIN=1/1"
check "staff: current/active/total" "$(d .data.staff.current)/$(d .data.staff.active)/$(d .data.staff.total)" "2/2/2"
check "staff by type" "$(d .data.staff.byType.teaching):$(d .data.staff.byType.driver):$(d .data.staff.byType.admin)" "1:1:0"
reqs "GET /dashboard/kpis :: one campus" GET "/dashboard/kpis?campusId=$COLLEGE" "$AT"
check "narrow to one campus" "$(d .data.scope):$(d .data.students.total):$(d .data.staff.current)" "campus:1:0"

req GET /dashboard/kpis "$BT"
check "branch principal sees only COLLEGE" "$(d .data.scope):$(d '.data.campusIds|join(",")'):$(d .data.students.total):$(d .data.staff.total)" "campus:$COLLEGE:1:0"
reqs "GET /dashboard/kpis :: campus outside scope" GET "/dashboard/kpis?campusId=$MAIN" "$BT"; check "branch asking for MAIN" "$ST" 403
req GET /dashboard/kpis "$ACT"; check "accountant: students only (no staff.read)" "$ST:$(d '.data|has("students")'):$(d '.data|has("staff")')" "200:true:false"

req POST /users "$AT" '{"username":"kpi.none","password":"KpiNone123","roles":["teacher"],"mustChangePassword":false}'
req POST /roles "$AT" '{"code":"auditor","name":"Auditor","permissions":["audit.read"]}'
req POST /users "$AT" '{"username":"auditor.one","password":"Auditor123","roles":["auditor"],"mustChangePassword":false}'
IP=198.51.100.51
req POST /auth/login "" '{"identifier":"kpi.none","password":"KpiNone123"}'; NT=$(d .data.accessToken)
reqs "GET /dashboard/kpis :: no permission" GET /dashboard/kpis "$NT"; check "teacher without student/staff read" "$ST" 403
req POST /auth/login "" '{"identifier":"auditor.one","password":"Auditor123"}'; AUT=$(d .data.accessToken)
IP=198.51.100.10

# ---- audit.read must not bypass sensitive-data permissions
req GET "/audit-logs?tableName=student_health&recordId=$RAM" "$AUT"
check "auditor sees health audit entries, data redacted" "$ST:$(d '[.data.items[]|select(.newData!=null)|.newData|has("allergies")]|any'):$(d '.data.items[0].newData.redacted // .data.items[1].newData.redacted')" "200:false:needs student.health.read"
req GET "/audit-logs?tableName=persons&recordId=$HARI" "$AUT"; check "auditor: religion stripped from person snapshots" "$(d '[.data.items[]|.newData // {}|has("religion")]|any')" false
req GET "/audit-logs?tableName=student_health&recordId=$RAM" "$AT"; check "principal sees health snapshots" "$(d '[.data.items[]|.newData // {}|has("allergies")]|any')" true

# ---- account administration is audited, never with secrets
req GET "/audit-logs?tableName=users&limit=100" "$AT"
check "user creations audited" "$(d '[.data.items[]|select(.action=="insert")]|length >= 5')" true
check "no password hash in user audit" "$(d '[.data.items[]|(.newData // {}),(.oldData // {})|has("passwordHash")]|any')" false
req GET "/audit-logs?tableName=users&recordId=$TID" "$AT"
check "password reset and suspension audited" "$(d '[.data.items[]|.newData.passwordReset // empty]|any'):$(d '[.data.items[]|select(.newData.status=="suspended")]|length >= 1')" "true:true"
