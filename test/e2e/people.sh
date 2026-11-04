#!/usr/bin/env bash
# Organization, persons, students, guardians, staff, branch scoping, sensitive data, audit.
# Sourced by run.sh after auth.sh (uses AT = school principal token for tenant e2eschool).

echo "== people suite"
TEN=e2eschool
TODAY=$(TZ=Asia/Kathmandu date +%F); YEAR=${TODAY:0:4}

# ---------------------------------------------------------------- organization
reqs "POST /campuses" POST /campuses "$AT" '{"code":"main","name":"Sunrise Main School","kind":"school","emisSchoolCode":"340010001"}'
MAIN=$(d .data.id); check "create campus (code uppercased)" "$ST:$(d .data.code)" "201:MAIN"
req POST /campuses "$AT" '{"code":"COLLEGE","name":"Sunrise College","kind":"college","phone":"01-441-2345"}'
COLLEGE=$(d .data.id); check "college campus, phone normalized" "$ST:$(d .data.phone)" "201:014412345"
reqs "POST /campuses :: duplicate code" POST /campuses "$AT" '{"code":"MAIN","name":"Dup"}'; check "duplicate campus code" "$ST" 409
req POST /campuses "$AT" '{"code":"bad code!","name":"X"}'; check "invalid campus code" "$ST" 400
reqs "GET /campuses" GET "/campuses?isActive=true" "$AT"; check "list campuses" "$(d '.data|length')" 2
req GET "/campuses?kind=college" "$AT"; check "filter campuses by kind" "$(d '.data|length')" 1
reqs "GET /campuses/{id}" GET /campuses/$MAIN "$AT"; check "get campus" "$(d .data.code)" MAIN
reqs "PATCH /campuses/{id}" PATCH /campuses/$MAIN "$AT" '{"name":"Sunrise Main"}'
check "patch keeps other fields" "$(d .data.name):$(d .data.code):$(d .data.kind)" "Sunrise Main:MAIN:school"
reqs "PATCH /campuses/{id} :: null on required field" PATCH /campuses/$MAIN "$AT" '{"name":null}'; check "null on required field" "$ST" 400
req POST /campuses "$AT" '{"code":"TEMP","name":"Temporary Branch"}'; TEMPC=$(d .data.id)
reqs "DELETE /campuses/{id}" DELETE /campuses/$TEMPC "$AT"; check "delete unused campus" "$ST" 204

reqs "POST /departments" POST /departments "$AT" "{\"campusId\":\"$MAIN\",\"code\":\"SCI\",\"name\":\"Science\"}"; SCI=$(d .data.id); check "create department" "$ST" 201
reqs "POST /departments :: duplicate name" POST /departments "$AT" "{\"campusId\":\"$MAIN\",\"name\":\"science\"}"; check "duplicate dept (case-insensitive)" "$ST" 409
req POST /departments "$AT" "{\"campusId\":\"$COLLEGE\",\"name\":\"Science\"}"; CSCI=$(d .data.id); check "same name other campus ok" "$ST" 201
req POST /departments "$AT" '{"campusId":"00000000-0000-0000-0000-000000000000","name":"Ghost"}'; check "dept on unknown campus" "$ST" 400
reqs "GET /departments" GET "/departments?campusId=$MAIN" "$AT"; check "list departments" "$(d '.data|length')" 1
reqs "GET /departments/{id}" GET /departments/$SCI "$AT"; check "get department" "$(d .data.name)" Science
reqs "PATCH /departments/{id}" PATCH /departments/$SCI "$AT" '{"code":"SCIENCE"}'; check "patch department" "$(d .data.code)" SCIENCE
req POST /departments "$AT" '{"name":"Old Dept"}'; OLDD=$(d .data.id)
reqs "DELETE /departments/{id}" DELETE /departments/$OLDD "$AT"; check "delete unused department" "$ST" 204

reqs "POST /designations" POST /designations "$AT" '{"name":"Teacher"}'; TEACHER_DES=$(d .data.id); check "create designation" "$ST" 201
reqs "POST /designations :: duplicate" POST /designations "$AT" '{"name":"teacher"}'; check "duplicate designation" "$ST" 409
req POST /designations "$AT" '{"name":"Driver"}'; DRIVER_DES=$(d .data.id)
reqs "GET /designations" GET /designations "$AT"; check "list designations" "$(d '.data|length')" 2
reqs "GET /designations/{id}" GET /designations/$DRIVER_DES "$AT"; check "get designation" "$(d .data.name)" Driver
reqs "PATCH /designations/{id}" PATCH /designations/$DRIVER_DES "$AT" '{"name":"Bus Driver"}'; check "patch designation" "$(d .data.name)" "Bus Driver"
req POST /designations "$AT" '{"name":"Peon"}'; PEON=$(d .data.id)
reqs "DELETE /designations/{id}" DELETE /designations/$PEON "$AT"; check "delete unused designation" "$ST" 204

reqs "GET /number-sequences" GET /number-sequences "$AT"; check "sequence preview" "$(d '.data[]|select(.code=="admission_no").preview')" "ADM-$YEAR-00001"
reqs "PATCH /number-sequences/{code} :: counter not editable" PATCH /number-sequences/admission_no "$AT" '{"nextValue":1}'; check "next_value not editable" "$ST" 400
reqs "PATCH /number-sequences/{code}" PATCH /number-sequences/employee_code "$AT" '{"padding":5}'; check "change padding" "$(d .data.preview)" "EMP-00001"
req PATCH /number-sequences/employee_code "$AT" '{"padding":4}'

# ---------------------------------------------------------------- persons
reqs "POST /persons" POST /persons "$AT" '{"firstName":"Hari","lastName":"Sharma","gender":"male","dob":"1985-02-10","religion":"Hindu","contacts":[{"type":"phone","value":"984-100-0000","isPrimary":true},{"type":"email","value":"Hari@Mail.com"}],"addresses":[{"type":"current","line1":"Baneshwor-10","municipality":"Kathmandu Metropolitan City","district":"Kathmandu","province":"Bagmati","latitude":27.7172,"longitude":85.324}]}'
HARI=$(d .data.id)
check "create person with contacts/address" "$ST:$(d .data.displayName):$(d '.data.contacts[0].value'):$(d '.data.contacts[1].value')" "201:Hari Sharma:9841000000:hari@mail.com"
check "principal sees sensitive field" "$(d .data.religion)" Hindu
check "coordinates are numbers" "$(d '.data.addresses[0].latitude')" 27.7172
reqs "POST /persons :: invalid phone" POST /persons "$AT" '{"firstName":"X","contacts":[{"type":"phone","value":"12"}]}'; check "invalid phone" "$ST" 400
req POST /persons "$AT" '{"firstName":"X","dob":"2999-01-01"}'; check "future dob" "$ST" 400
req POST /persons "$AT" '{"firstName":"X","dob":"2026-02-30"}'; check "impossible date" "$ST" 400
req POST /persons "$AT" '{"firstName":"   "}'; check "blank first name" "$ST" 400
req POST /persons "$AT" '{"firstName":"X","contacts":[{"type":"phone","value":"9800000001","isPrimary":true},{"type":"phone","value":"9800000002","isPrimary":true}]}'; check "two primaries same type" "$ST" 400
reqs "GET /persons/lookup" GET "/persons/lookup?contact=9841000000" "$AT"; check "lookup by phone" "$(d '.data[0].id')" "$HARI"
reqs "GET /persons" GET "/persons?search=hari" "$AT"; check "list persons" "$(d .data.total)" 1
reqs "GET /persons/{id}" GET /persons/$HARI "$AT"; check "get person" "$(d .data.firstName)" Hari
reqs "PATCH /persons/{id}" PATCH /persons/$HARI "$AT" '{"middleName":"Prasad","bloodGroup":"O+"}'; check "patch person" "$(d .data.displayName):$(d .data.bloodGroup)" "Hari Prasad Sharma:O+"
reqs "POST /persons/{id}/contacts" POST /persons/$HARI/contacts "$AT" '{"type":"phone","value":"9841999999","isPrimary":true}'; NEWPH=$(d .data.id); check "add contact" "$ST" 201
req GET /persons/$HARI "$AT"; check "new primary demotes old" "$(d '[.data.contacts[]|select(.type=="phone" and .isPrimary)]|length')" 1
reqs "PATCH /persons/{id}/contacts/{contactId}" PATCH /persons/$HARI/contacts/$NEWPH "$AT" '{"value":"9841888888"}'; check "update contact" "$(d .data.value)" 9841888888
reqs "DELETE /persons/{id}/contacts/{contactId}" DELETE /persons/$HARI/contacts/$NEWPH "$AT"; check "remove contact" "$ST" 204
reqs "POST /persons/{id}/addresses" POST /persons/$HARI/addresses "$AT" '{"type":"permanent","district":"Chitwan","ward":"5"}'; ADDR=$(d .data.id); check "add address" "$ST" 201
reqs "PATCH /persons/{id}/addresses/{addressId}" PATCH /persons/$HARI/addresses/$ADDR "$AT" '{"municipality":"Bharatpur"}'; check "update address" "$(d .data.municipality):$(d .data.district)" "Bharatpur:Chitwan"
reqs "DELETE /persons/{id}/addresses/{addressId}" DELETE /persons/$HARI/addresses/$ADDR "$AT"; check "remove address" "$ST" 204

# ---------------------------------------------------------------- students
reqs "POST /students :: incomplete person" POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"person\":{\"firstName\":\"Ram\",\"lastName\":\"Sharma\"}}"; check "student needs dob+gender" "$ST" 400
reqs "POST /students :: transfer_in without previous school" POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"admissionType\":\"transfer_in\",\"person\":{\"firstName\":\"Ram\",\"gender\":\"male\",\"dob\":\"2015-04-14\"}}"; check "transfer_in needs previous school" "$ST" 400
req POST /students "$AT" "{\"personId\":\"$HARI\",\"person\":{\"firstName\":\"X\"},\"admissionDate\":\"$TODAY\"}"; check "both personId and person" "$ST" 400
reqs "POST /students" POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"emisId\":\"0012345\",\"previousSchoolClass\":\"Grade 4\",\"person\":{\"firstName\":\"Ram\",\"lastName\":\"Sharma\",\"gender\":\"male\",\"dob\":\"2015-04-14\",\"bloodGroup\":\"B+\",\"contacts\":[{\"type\":\"phone\",\"value\":\"9861234567\",\"isPrimary\":true}],\"addresses\":[{\"type\":\"current\",\"district\":\"Kathmandu\"}]}}"
RAM=$(d .data.id); RAMP=$(d .data.person.id)
check "admit student" "$ST:$(d .data.status):$(d .data.admissionNo):$(d .data.emisId)" "201:applicant:ADM-$YEAR-00001:0012345"
reqs "POST /students :: duplicate EMIS id" POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"emisId\":\"0012345\",\"person\":{\"firstName\":\"Dup\",\"gender\":\"male\",\"dob\":\"2015-01-01\"}}"; check "duplicate EMIS id" "$ST" 409
req POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"personId\":\"$RAMP\"}"; check "person already a student" "$ST" 409
reqs "POST /students/{id}/status :: no primary guardian" POST /students/$RAM/status "$AT" '{"status":"active"}'; check "activation needs primary guardian" "$ST" 400
reqs "POST /students/{id}/guardians" POST /students/$RAM/guardians "$AT" '{"relation":"mother","isPrimary":true,"isEmergencyContact":true,"guardian":{"person":{"firstName":"Sita","lastName":"Sharma","contacts":[{"type":"phone","value":"9851111111","isPrimary":true}]},"occupation":"Teacher","annualIncome":850000}}'
check "link inline guardian" "$ST:$(d '.data|length'):$(d '.data[0].isPrimary'):$(d '.data[0].primaryPhone')" "201:1:true:9851111111"
SITA_G=$(d '.data[0].guardianId')
reqs "POST /guardians" POST /guardians "$AT" "{\"personId\":\"$HARI\",\"occupation\":\"Engineer\",\"qualification\":\"Bachelor\",\"employer\":\"Nepal Telecom\"}"; HARI_G=$(d .data.id); check "guardian from existing person" "$ST" 201
reqs "POST /guardians :: person already guardian" POST /guardians "$AT" "{\"personId\":\"$HARI\"}"; check "second guardian profile" "$ST" 409
req POST /students/$RAM/guardians "$AT" "{\"guardianId\":\"$HARI_G\",\"relation\":\"father\"}"; check "link existing guardian" "$ST:$(d '.data|length')" "201:2"
reqs "POST /students/{id}/guardians :: already linked" POST /students/$RAM/guardians "$AT" "{\"guardianId\":\"$HARI_G\",\"relation\":\"father\"}"; check "duplicate link" "$ST" 409
reqs "POST /students/{id}/status" POST /students/$RAM/status "$AT" '{"status":"active","reason":"Documents verified"}'; check "activate" "$ST:$(d .data.status)" "200:active"
req POST /students/$RAM/status "$AT" '{"status":"active"}'; check "same status" "$ST" 400
reqs "DELETE /students/{id}/guardians/{guardianId} :: primary of active student" DELETE /students/$RAM/guardians/$SITA_G "$AT"; check "cannot unlink primary of active student" "$ST" 409
req PATCH /students/$RAM/guardians/$SITA_G "$AT" '{"isPrimary":false}'; check "cannot demote only primary" "$ST" 409
reqs "PATCH /students/{id}/guardians/{guardianId}" PATCH /students/$RAM/guardians/$HARI_G "$AT" '{"isPrimary":true,"canPickup":false}'
check "switch primary" "$(d '[.data[]|select(.isPrimary)]|length'):$(d '.data[0].guardianId'):$(d '.data[0].canPickup')" "1:$HARI_G:false"
reqs "GET /students/{id}/guardians" GET /students/$RAM/guardians "$AT"; check "list student guardians" "$(d '.data|length')" 2
reqs "GET /students/{id}/status-history" GET /students/$RAM/status-history "$AT"; check "status history" "$(d '.data|length'):$(d '.data[1].toStatus')" "2:active"
req GET /students/$RAM/health "$AT"; check "empty health record" "$ST:$(d .data.allergies)" "200:null"
reqs "PUT /students/{id}/health" PUT /students/$RAM/health "$AT" '{"allergies":"Peanuts","medicalConditions":"Asthma","doctorName":"Dr. K. Thapa","doctorPhone":"985-100-0000","emergencyInstructions":"Inhaler in school bag"}'
check "put health" "$(d .data.allergies):$(d .data.doctorPhone)" "Peanuts:9851000000"
reqs "GET /students/{id}/health" GET /students/$RAM/health "$AT"; check "get health" "$(d .data.medicalConditions)" Asthma
reqs "POST /students/{id}/status :: exit without leavingDate" POST /students/$RAM/status "$AT" '{"status":"alumni"}'; check "exit needs leavingDate" "$ST" 400
req POST /students/$RAM/status "$AT" '{"status":"alumni","leavingDate":"2000-01-01"}'; check "leaving before admission" "$ST" 400
req POST /students/$RAM/status "$AT" '{"status":"suspended","leavingDate":"2030-01-01"}'; check "leaving details on non-exit" "$ST" 400
reqs "POST /students/{id}/status :: transfer out" POST /students/$RAM/status "$AT" "{\"status\":\"transferred_out\",\"leavingDate\":\"$TODAY\",\"leavingReason\":\"Family moved\",\"tcIssuedNo\":\"TC-1\",\"reason\":\"Moved to Pokhara\"}"
check "transfer out" "$(d .data.status):$(d .data.tcIssuedNo)" "transferred_out:TC-1"
req POST /students/$RAM/status "$AT" '{"status":"active","reason":"Readmitted"}'; check "readmit clears leaving date" "$(d .data.status):$(d .data.leavingDate)" "active:null"
reqs "DELETE /students/{id} :: not an applicant" DELETE /students/$RAM "$AT"; check "cannot delete admitted student" "$ST" 409
reqs "GET /students" GET "/students?search=ram&status=active&page=1&limit=20" "$AT"; check "search by name" "$(d .data.total)" 1
req GET "/students?search=ADM-$YEAR-00001" "$AT"; check "search by admission no" "$(d .data.total)" 1
req GET "/students?search=%25" "$AT"; check "LIKE wildcard escaped" "$(d .data.total)" 0
reqs "GET /students/{id}" GET /students/$RAM "$AT"; check "student detail" "$(d '.data.guardians|length'):$(d .data.campus.code)" "2:MAIN"
reqs "PATCH /students/{id}" PATCH /students/$RAM "$AT" '{"hasSpecialNeeds":true,"remarks":"Needs front-row seating"}'; check "patch student" "$(d .data.hasSpecialNeeds)" true
reqs "PATCH /students/{id} :: status not patchable" PATCH /students/$RAM "$AT" '{"status":"alumni"}'; check "status not patchable" "$ST" 400
req PATCH /students/$RAM "$AT" '{"admissionNo":"X"}'; check "admission no not patchable" "$ST" 400
req POST /students "$AT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"person\":{\"firstName\":\"Temp\",\"gender\":\"female\",\"dob\":\"2016-01-01\"}}"; TEMP=$(d .data.id)
check "next admission number" "$(d .data.admissionNo)" "ADM-$YEAR-00002"
reqs "DELETE /students/{id}" DELETE /students/$TEMP "$AT"; check "delete applicant" "$ST" 204
req GET /students/$TEMP "$AT"; check "deleted student hidden" "$ST" 404

# ---------------------------------------------------------------- guardians
reqs "GET /guardians" GET "/guardians?search=9851111111" "$AT"; check "find guardian by phone" "$(d .data.total):$(d '.data.items[0].person.primaryPhone')" "1:9851111111"
reqs "GET /guardians/{id}" GET /guardians/$SITA_G "$AT"; check "guardian detail" "$(d '.data.children|length'):$(d .data.annualIncome)" "1:850000"
reqs "PATCH /guardians/{id}" PATCH /guardians/$SITA_G "$AT" '{"employer":"Sunrise School","annualIncome":900000}'; check "patch guardian" "$(d .data.employer):$(d .data.annualIncome)" "Sunrise School:900000"
reqs "DELETE /guardians/{id} :: still linked" DELETE /guardians/$SITA_G "$AT"; check "cannot delete linked guardian" "$ST" 409
req POST /guardians "$AT" '{"person":{"firstName":"Unlinked"}}'; ORPHAN=$(d .data.id)
reqs "DELETE /guardians/{id}" DELETE /guardians/$ORPHAN "$AT"; check "delete unlinked guardian" "$ST" 204

# ---------------------------------------------------------------- staff
reqs "POST /staff :: missing teacherProfile" POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"staffType\":\"teaching\",\"joiningDate\":\"$TODAY\",\"person\":{\"firstName\":\"Gita\"}}"; check "teaching needs teacherProfile" "$ST" 400
req POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"staffType\":\"admin\",\"joiningDate\":\"$TODAY\",\"teacherProfile\":{},\"person\":{\"firstName\":\"Gita\"}}"; check "profile must match type" "$ST" 400
reqs "POST /staff :: department on another campus" POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"departmentId\":\"$CSCI\",\"staffType\":\"admin\",\"joiningDate\":\"$TODAY\",\"person\":{\"firstName\":\"Gita\"}}"; check "department on other campus" "$ST" 400
reqs "POST /staff" POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"departmentId\":\"$SCI\",\"designationId\":\"$TEACHER_DES\",\"staffType\":\"teaching\",\"employmentType\":\"permanent\",\"joiningDate\":\"$TODAY\",\"emergencyContactName\":\"Mohan Rai\",\"emergencyContactPhone\":\"9800000000\",\"teacherProfile\":{\"highestQualification\":\"M.Ed.\",\"specialization\":\"Mathematics\",\"experienceYears\":6.5,\"maxWeeklyPeriods\":30},\"person\":{\"firstName\":\"Gita\",\"lastName\":\"Rai\",\"gender\":\"female\",\"contacts\":[{\"type\":\"email\",\"value\":\"gita@e2eschool.test\",\"isPrimary\":true}]}}"
GITA=$(d .data.id); GITAP=$(d .data.person.id)
check "onboard teacher" "$ST:$(d .data.employeeCode):$(d .data.teacherProfile.experienceYears):$(d .data.department.name)" "201:EMP-0001:6.5:Science"
reqs "POST /staff :: expired licence" POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"staffType\":\"driver\",\"joiningDate\":\"$TODAY\",\"driverProfile\":{\"licenseNo\":\"01-06-1\",\"licenseExpiry\":\"2020-01-01\"},\"person\":{\"firstName\":\"Bir\"}}"; check "expired licence" "$ST" 400
req POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"designationId\":\"$DRIVER_DES\",\"staffType\":\"driver\",\"joiningDate\":\"$TODAY\",\"reportsTo\":\"$GITA\",\"driverProfile\":{\"licenseNo\":\"01-06-12345678\",\"licenseClass\":\"B, C\",\"licenseExpiry\":\"2030-01-01\"},\"person\":{\"firstName\":\"Bir\",\"lastName\":\"Gurung\"}}"
BIR=$(d .data.id); check "onboard driver" "$ST:$(d .data.employeeCode):$(d .data.manager.employeeCode)" "201:EMP-0002:EMP-0001"
req PATCH /staff/$GITA "$AT" "{\"reportsTo\":\"$GITA\"}"; check "cannot report to self" "$ST" 400
reqs "PATCH /staff/{id} :: reporting cycle" PATCH /staff/$GITA "$AT" "{\"reportsTo\":\"$BIR\"}"; check "reporting cycle" "$ST" 400
req PATCH /staff/$BIR "$AT" '{"staffType":"teaching"}'; check "type change needs profile" "$ST" 400
reqs "PATCH /staff/{id}" PATCH /staff/$GITA "$AT" '{"employmentType":"contract","probationEndDate":"2099-01-01"}'; check "patch staff" "$(d .data.employmentType)" contract
reqs "PUT /staff/{id}/teacher-profile" PUT /staff/$GITA/teacher-profile "$AT" '{"specialization":"Physics","maxWeeklyPeriods":28}'; check "put teacher profile" "$(d .data.teacherProfile.specialization)" Physics
reqs "PUT /staff/{id}/driver-profile" PUT /staff/$BIR/driver-profile "$AT" '{"licenseNo":"01-06-12345678","licenseExpiry":"2031-06-30","medicalFitnessExpiry":"2027-06-30"}'; check "put driver profile" "$(d .data.driverProfile.licenseExpiry)" 2031-06-30
req PUT /staff/$BIR/teacher-profile "$AT" '{}'; check "teacher profile on driver" "$ST" 400
reqs "POST /staff/{id}/status :: missing leavingDate" POST /staff/$GITA/status "$AT" '{"status":"resigned"}'; check "resign needs leavingDate" "$ST" 400
reqs "POST /staff/{id}/status" POST /staff/$GITA/status "$AT" "{\"status\":\"resigned\",\"leavingDate\":\"$TODAY\",\"leavingReason\":\"Higher studies\"}"; check "resign" "$(d .data.status)" resigned
req POST /staff/$GITA/status "$AT" '{"status":"active"}'; check "rejoin clears leaving" "$(d .data.status):$(d .data.leavingDate)" "active:null"
reqs "POST /staff/{id}/qualifications" POST /staff/$GITA/qualifications "$AT" '{"degree":"B.Ed.","institution":"Tribhuvan University","passedYear":2018}'; Q=$(d .data.id); check "add qualification" "$ST" 201
req POST /staff/$GITA/qualifications "$AT" '{"degree":"X","passedYear":2999}'; check "future passed year" "$ST" 400
reqs "PATCH /staff/{id}/qualifications/{qualificationId}" PATCH /staff/$GITA/qualifications/$Q "$AT" '{"grade":"First Division"}'; check "update qualification" "$(d .data.grade)" "First Division"
reqs "GET /staff/{id}" GET /staff/$GITA "$AT"; check "staff detail" "$(d '.data.qualifications|length'):$(d .data.directReports)" "1:1"
reqs "DELETE /staff/{id}/qualifications/{qualificationId}" DELETE /staff/$GITA/qualifications/$Q "$AT"; check "remove qualification" "$ST" 204
reqs "DELETE /staff/{id} :: has direct reports" DELETE /staff/$GITA "$AT"; check "cannot delete manager with reports" "$ST" 409
req DELETE /designations/$TEACHER_DES "$AT"; check "designation in use" "$ST" 409
reqs "DELETE /campuses/{id} :: in use" DELETE /campuses/$MAIN "$AT"; check "campus in use" "$ST" 409
reqs "GET /staff" GET "/staff?staffType=driver&status=active" "$AT"; check "list staff" "$(d .data.total)" 1
req POST /staff "$AT" "{\"campusId\":\"$MAIN\",\"staffType\":\"support\",\"joiningDate\":\"$TODAY\",\"person\":{\"firstName\":\"Mistake\"}}"; WRONG=$(d .data.id)
reqs "DELETE /staff/{id}" DELETE /staff/$WRONG "$AT"; check "delete staff record" "$ST" 204

# ---------------------------------------------------------------- branch-scoped principal (COLLEGE only)
req POST /users "$AT" '{"username":"branch.head","email":"branch@e2eschool.test","password":"BranchPass1","mustChangePassword":false}'; BU=$(d .data.id)
reqs "POST /users/{id}/roles :: campus-scoped principal" POST /users/$BU/roles "$AT" "{\"role\":\"principal\",\"scopeType\":\"campus\",\"scopeId\":\"$COLLEGE\"}"
check "assign campus-scoped principal" "$ST:$(d '.data.roles[0].scopeType')" "200:campus"
req POST /users/$BU/roles "$AT" "{\"role\":\"principal\",\"scopeType\":\"campus\",\"scopeId\":\"$COLLEGE\"}"; check "duplicate assignment" "$ST" 409
req POST /users/$BU/roles "$AT" "{\"role\":\"teacher\",\"scopeType\":\"section\",\"scopeId\":\"$COLLEGE\"}"; check "section scope not yet" "$ST" 400
req POST /users/$BU/roles "$AT" "{\"role\":\"teacher\",\"scopeType\":\"campus\",\"scopeId\":\"$SCI\"}"; check "campus scope with dept id" "$ST" 400
IP=198.51.100.31
req POST /auth/login "" '{"identifier":"branch.head","password":"BranchPass1"}'; check "branch principal needs OTP" "$(d .data.status)" otp_required; CH=$(d .data.challengeId)
req POST /auth/verify-otp "" "{\"challengeId\":\"$CH\",\"code\":\"$(otp branch@e2eschool.test)\"}"; BT=$(d .data.accessToken)
req GET /students "$BT"; check "branch sees no MAIN students" "$ST:$(d .data.total)" "200:0"
req GET /students/$RAM "$BT"; check "branch cannot open MAIN student" "$ST" 404
req PATCH /students/$RAM "$BT" '{"remarks":"x"}'; check "branch cannot edit MAIN student" "$ST" 404
req GET /students/$RAM/health "$BT"; check "branch cannot read MAIN health" "$ST" 404
reqs "POST /students :: no access to campus" POST /students "$BT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"person\":{\"firstName\":\"Y\",\"gender\":\"male\",\"dob\":\"2010-01-01\"}}"; check "branch cannot admit to MAIN" "$ST" 403
req POST /students "$BT" "{\"admissionDate\":\"$TODAY\",\"person\":{\"firstName\":\"Y\",\"gender\":\"male\",\"dob\":\"2010-01-01\"}}"; check "branch cannot admit without campus" "$ST" 403
req POST /students "$BT" "{\"campusId\":\"$COLLEGE\",\"admissionDate\":\"$TODAY\",\"person\":{\"firstName\":\"Kiran\",\"gender\":\"male\",\"dob\":\"2008-05-05\"}}"; KIRAN=$(d .data.id)
check "branch admits to own campus" "$ST:$(d .data.campus.code)" "201:COLLEGE"
req PATCH /students/$KIRAN "$BT" "{\"campusId\":\"$MAIN\"}"; check "branch cannot move student to MAIN" "$ST" 403
req POST /students/$KIRAN/guardians "$BT" '{"relation":"father","isPrimary":true,"guardian":{"person":{"firstName":"Mohan"}}}'; check "branch links inline guardian" "$ST" 201
req GET /students "$BT"; check "branch sees own student only" "$(d .data.total)" 1
req GET /staff "$BT"; check "branch sees no MAIN staff" "$(d .data.total)" 0
req GET /staff/$GITA "$BT"; check "branch cannot open MAIN staff" "$ST" 404
req GET /persons/$HARI "$BT"; check "branch cannot open MAIN parent" "$ST" 404
req GET /guardians/$SITA_G "$BT"; check "branch cannot open MAIN guardian" "$ST" 404
req GET "/persons/lookup?contact=9841000000" "$BT"; check "lookup works, minimal fields" "$(d '.data|length'):$(d '.data[0]|has("dob")')" "1:false"
req POST /campuses "$BT" '{"code":"X","name":"Hack"}'; check "branch cannot manage campuses" "$ST" 403
req GET /campuses "$BT"; check "branch can list campuses" "$ST" 200
req POST /users/$BU/roles "$BT" '{"role":"admin"}'; check "branch cannot assign roles" "$ST" 403
req GET /audit-logs "$BT"; check "branch cannot read audit" "$ST" 403

# ---------------------------------------------------------------- sensitive data (accountant: institution-wide, no MFA)
IP=198.51.100.32
req POST /users "$AT" '{"username":"acc.one","password":"AccPass123","roles":["accountant"],"mustChangePassword":false}'; ACC=$(d .data.id)
req POST /auth/login "" '{"identifier":"acc.one","password":"AccPass123"}'; ACT=$(d .data.accessToken)
check "accountant logs in without OTP" "$(d .data.status)" authenticated
req GET /persons/$HARI "$ACT"; check "religion hidden without person.sensitive.read" "$ST:$(d '.data|has("religion")')" "200:false"
req GET /guardians/$SITA_G "$ACT"; check "accountant sees income" "$(d .data.annualIncome)" 900000
reqs "GET /students/{id}/health :: missing permission" GET /students/$RAM/health "$ACT"; check "accountant cannot read health" "$ST" 403
req POST /students "$ACT" "{\"campusId\":\"$MAIN\",\"admissionDate\":\"$TODAY\",\"personId\":\"$HARI\"}"; check "accountant cannot admit" "$ST" 403
req PATCH /persons/$HARI "$ACT" '{"religion":"X"}'; check "accountant cannot edit person" "$ST" 403
req GET /students/$RAM "$ACT"; check "accountant reads student without religion" "$ST:$(d '.data.person|has("religion")')" "200:false"

# ---------------------------------------------------------------- login link + /auth/me
reqs "PUT /persons/{id}/user" PUT /persons/$GITAP/user "$AT" "{\"userId\":\"$ACC\"}"; check "link login to person" "$ST:$(d .data.userId)" "200:$ACC"
reqs "PUT /persons/{id}/user :: login already linked" PUT /persons/$RAMP/user "$AT" "{\"userId\":\"$ACC\"}"; check "same login on second person" "$ST" 409
req GET /auth/me "$ACT"; check "/auth/me shows linked person" "$(d .data.person.displayName)" "Gita Rai"

# ---------------------------------------------------------------- audit trail
req GET "/audit-logs?tableName=student_health&action=read&recordId=$RAM" "$AT"; check "health reads audited" "$(d '.data.total >= 1')" true
reqs "GET /audit-logs" GET "/audit-logs?tableName=students&recordId=$RAM&limit=50" "$AT"
check "student changes audited" "$(d '[.data.items[].action]|map(select(.=="insert"))|length'):$(d '.data.total >= 5')" "1:true"
req GET "/audit-logs?tableName=student_guardians&action=update&recordId=$RAM" "$AT"
check "link change audited with old+new" "$(d '.data.items[0].oldData.isPrimary'):$(d '.data.items[0].newData.isPrimary')" "false:true"
IP=198.51.100.10
