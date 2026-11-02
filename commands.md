# master DB
npm run migration:master:generate -- src/migrations/master/Init
npm run migration:master:run

# tenant schema (generated against the empty tenant_template)
npm run migration:tenant:generate -- src/migrations/tenant/Init
npm run migration:tenant:run     # applies it to tenant_template so future diffs are correct

# Day-to-day: changing a tenant entity

npm run migration:tenant:generate -- src/migrations/tenant/AddPhoneToUser
npm run migration:tenant:run            # update the template DB
npm run migration:tenants:run-all       # apply to every existing tenant

# Production deploy order
npm run build
npm run migration:master:run
npm run migration:tenants:run-all   # must succeed before the new code starts
node dist/main


# dump
pg_dump -h localhost -p 5432 -U postgres -F c -v -f master_db.dump master_db

pg_dump -h localhost -U postgres -F c -f tenant_sunrise.dump tenant_sunrise

pg_dumpall -h localhost -U postgres --roles-only -f roles.sql

# restore from dump file
<!-- createdb -h localhost -U postgres master_db -->
<!-- pg_restore -h localhost -U postgres -d master_db -v master_db.dump -->


pg_restore -h localhost -U postgres -C -d postgres -v master_db.dump

pg_restore -h localhost -U postgres -C -d postgres -v tenant_sunrise.dump

createdb -h localhost -U postgres tenant_template

npm run migration:tenant:run

npm run migration:tenants:run-all