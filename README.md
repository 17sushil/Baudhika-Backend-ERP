# School ERP Backend (NestJS + PostgreSQL + TypeORM)

Database-per-tenant architecture. One **master** database (the control plane) holds the tenant registry,
platform admins and branding. Every school (tenant) gets its **own PostgreSQL database and its own
Postgres role**. No `tenant_id` columns: isolation is the database boundary.

All schema changes go through **migrations**. `synchronize` is `false` everywhere and must stay that way.

---

## 1. How it works

```
Request (x-tenant-id: sunrise, Authorization: Bearer <tenant JWT>)
   │
   ├─ TenantMiddleware      validates slug, looks it up (30 s in-memory cache), rejects
   │                        unknown / provisioning / failed (404) and suspended (403) tenants
   │
   ├─ TenantConnectionService.get(tenant)   LRU of small per-tenant pools; idle pools are closed
   │
   ├─ TenantContext (AsyncLocalStorage)     { tenant, dataSource } for the rest of the request
   │
   └─ TenantAuthGuard       verifies JWT (tenant secret + audience), token.tid === tenant.id,
                            session not revoked, user active, password change not pending,
                            @RequirePermissions(...) at institution scope
```

Services never take a tenant id from the client: they call `ctx.repo(Entity)` on `TenantContext`.

| | Master DB | Tenant DBs |
|---|---|---|
| Contains | tenants, tenant_branding, platform_users, platform sessions + audit | users, roles, permissions, user_roles, user_sessions, ... |
| Count | 1 | One per school |
| Entities | `*.master.entity.ts` | `*.tenant.entity.ts` |
| Migrations | `src/migrations/master` | `src/migrations/tenant` |
| Applied by | `migration:master:run` | `migration:tenants:run-all` (and on tenant creation) |

---

## 2. Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ **with the contrib package** (`citext`). Fedora: `sudo dnf install postgresql-contrib`
  (or the PGDG `postgresql18-contrib`); Debian/Ubuntu ship it with the server. Managed Postgres has it.
- The role in `DB_USER` (or `PROVISIONER_DB_USER`) needs `CREATEDB` and `CREATEROLE`.

---

## 3. First-time setup

```bash
npm install
cp .env.template .env        # fill it in; generate secrets with openssl (see comments)
```

Create two empty databases: `master_db` and `tenant_template` (scratch DB used only to generate
tenant migrations). Then:

```bash
npm run migration:master:run
npm run migration:tenant:run
npm run seed:platform-admin      # needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run start:dev
```

Create a school (platform admin token from `POST /platform/auth/login` + `verify-otp`):

```bash
curl -X POST localhost:4000/tenants -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunrise School","slug":"sunrise","principalEmail":"principal@sunrise.edu","principalPassword":"a-long-initial-password"}'
```

---

## 4. Project structure

```
src/
  main.ts                      helmet, CORS, validation, trust proxy
  app.module.ts                config validation, throttling, module wiring
  config/env.validation.ts     fail-fast env checks (secrets present, distinct, long enough)
  common/
    constants/                 throttle presets
    interceptors/              TransformInterceptor: { statusCode, message, data } success envelope
    utils/                     crypto, passwords (argon2id), client IP, sql (LIKE escape, constraint errors), dates
    decorators/                validation helpers (IsDateOnly, Trim, IsOptionalNonNull)
    dto/                       pagination, shared response DTOs
    swagger/                   setup (/docs) and response/auth decorators
  infra/mail/                  MailService (console driver in dev)
  database/
    master/                    master DataSource + options
    tenant/                    tenant DataSource options (per-tenant host/user/password)
    scripts/                   migrate-tenants (canary + batches), seed-platform-admin
  migrations/{master,tenant}/
  modules/
    master/                    CONTROL PLANE (master DB)
      platform-auth/           platform admins: password + email OTP, rotating refresh tokens
      tenants/                 registry, provisioning, branding, public host resolution
    tenant/                    TENANT PLANE (one DB per school)
      context/                 TenantMiddleware, TenantContext (ALS), TenantConnectionService
      access/                  users, roles, permissions, user_roles entities + AccessService
      auth/                    login, OTP, refresh, logout, me, change-password, TenantAuthGuard
      users/                   school admin user management, scoped role assignment
      audit/                   append-only audit trail (GET /audit-logs)
      organization/            campuses (school/college branches), departments, designations, number series
      files/                   file metadata (upload API comes with S3)
      people/                  persons, contacts, addresses, phone lookup, login link
      guardians/               parents/guardians
      students/                admission, status lifecycle, health, guardian links
      staff/                   employees, teacher/driver profiles, qualifications
test/e2e/                      API end-to-end suites + runner (npm run test:e2e)
scripts/generate-api-docx.js   Word API reference generator (npm run docs:api)
docs/                          generated School_ERP_API_Reference.docx
```

Adding a tenant feature module: import `TenantAuthModule`, apply `TenantMiddleware` to its controllers
in `configure()`, guard them with `TenantAuthGuard` + `@RequirePermissions(...)` (institution-wide) or
`@RequireAccess(...)` (institution or campus; then filter with `campusScope()`), and use `TenantContext`.
See AGENTS.md for the full conventions.

---

## 5. API, roles and access

**Docs**
- Swagger UI: **http://localhost:4000/docs** (JSON: `/docs-json`), generated from the code. Disabled when
  `NODE_ENV=production` unless `SWAGGER_ENABLED=true`.
- Word reference: **[docs/School_ERP_API_Reference.docx](docs/School_ERP_API_Reference.docx)**: every endpoint with
  auth, parameters, each request field and its rules, response codes, and real request/response examples recorded by
  the e2e suite, plus roles, permissions and workflows. Regenerate after API changes with `npm run docs:api`.

Every success response is `{ statusCode, message: "success", data }`; errors are `{ statusCode, error, message }`.

| Group | Endpoints (school routes need `x-tenant-id`) |
|---|---|
| Platform | `/platform/auth/*` (login + OTP), `/tenants` (create school, branding), `/public/tenants/resolve` |
| School auth | `/auth/login`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/change-password` |
| Users | `/users` CRUD-ish, `/users/:id/status`, `/users/:id/reset-password`, `/users/:id/roles` (grant/revoke, campus scope) |
| Roles | `/permissions` (catalogue), `/roles` list/create/edit/delete (custom roles, hierarchy) |
| Organization | `/campuses` (school/college branches), `/departments`, `/designations`, `/number-sequences` |
| People | `/persons` (+ `/lookup`, contacts, addresses, `PUT /persons/:id/user` login link) |
| Students | `/students` (+ `/status`, `/status-history`, `/health`, `/guardians`) |
| Guardians / Staff | `/guardians`, `/staff` (+ `/status`, teacher/driver profiles, qualifications) |
| Dashboard | `/dashboard/kpis`: total students (enrolled, applicants, all, by status/gender/campus, admissions) and total staff (current, by type/campus) |
| Audit | `/audit-logs` |

**Login rules**
- OTP is required when `users.mfa_enabled` **or** the user holds a role with `requires_mfa` (seeded: `admin`,
  `principal`). Such users must have an email.
- 5 wrong passwords lock the account for 15 min; unknown user, wrong password and locked account look identical.
- `must_change_password` users can only call `me`, `change-password`, `logout` until they change it.
- Access token 15 min (`aud=tenant`, bound to the school via `tid`); refresh token single use, 7 days, session max 30 days.

**Roles and branches**
- `principal` is the top role of every school: it holds **every** permission (including `role.manage`), always requires OTP,
  can't lose a permission or be deleted, and gets new permissions from future releases automatically. The first account of
  every school (`POST /tenants`: `principalEmail` / `principalPassword`) is its principal; the last one can't be removed.
- `admin` sits below: every permission except `role.manage`. It runs the school (logins, roles below principal, students,
  staff, settings, audit) but can't design roles or grant `principal`.
- Role hierarchy = permission sets: you can only create, edit, assign, revoke or delete a role whose permissions you all
  hold yourself. A "role officer" with `role.manage` but fewer permissions manages roles below them, never the principal.
  Manage roles with `GET /permissions`, `GET/POST /roles`, `PATCH/DELETE /roles/:id` (custom roles like `librarian`).
- Roles carry permissions; `POST /users/:id/roles` assigns a role at `institution` scope (whole school) or `campus` scope
  (one branch). A campus-scoped user only sees and edits that branch's students, staff and their families.
- Nobody can grant, revoke or manage access beyond their own; the last school admin can't be removed.
- Religion/ethnicity, guardian income and health records need their own permissions (health reads are audited).

**Create an admin** (as the principal; the first principal comes from `POST /tenants`):

```bash
# admin logins always get an email OTP, so give them an email
curl -s -X POST $API/users -H 'x-tenant-id: sunrise' -H "Authorization: Bearer $PRINCIPAL_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"admin@sunrise.edu","username":"office.admin","password":"Welcome2026","mustChangePassword":true,"roles":["admin"]}'
# another principal, e.g. for one branch (only a principal can grant it)
curl -s -X POST $API/users/$USER_ID/roles -H 'x-tenant-id: sunrise' -H "Authorization: Bearer $PRINCIPAL_TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"principal","scopeType":"campus","scopeId":"<campus id>"}'
```

**Security notes** (full list in the Word reference, chapter 5)
- `audit.read` does not bypass sensitive data: health snapshots, religion/ethnicity and guardian income are redacted for
  readers without those permissions. Account creation, suspension and password resets are audited; secrets never are.
- Production refuses `MAIL_DRIVER=console` (it would log OTP codes) and warns when `TRUST_PROXY` is unset.
- Production dependencies: `npm audit --omit=dev` reports 0 vulnerabilities (multer pinned to 2.5.0 via `overrides`).

## 5a. Testing

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Jest). |
| `npm run test:e2e` | 278 API checks against a real server + Postgres: auth, isolation, sessions, lockout, rate limits, every CRUD endpoint, business rules, role hierarchy, branch scoping, sensitive fields, KPIs, audit redaction. ~2 min. |
| `npm run docs:api` | Runs the e2e suite and rebuilds the Word API reference from its real samples. |

`test:e2e` is self-contained: it creates `erp_e2e_master` (plus `tenant_e2eschool` / `tenant_e2eother`), builds
the app, starts it on port 4100 (`E2E_PORT` to change), runs `test/e2e/auth.sh`, `people.sh`, `roles.sh` and `dashboard.sh`, and
always drops those databases and roles afterwards. It never touches `master_db` or your schools.
Needs `psql`, `curl`, `jq`, Postgres with contrib, and `DB_*` in `.env`.

## 6. Provisioning and tenant isolation

`POST /tenants` (platform admin):

1. Claims the slug with a `provisioning` row (unique constraint makes concurrent creates safe).
2. Creates role `tenant_<slug>` (random password, sent as a SCRAM verifier so it never appears in logs,
   stored AES-256-GCM encrypted with `TENANT_SECRETS_KEY`) and database `tenant_<slug>` owned by it.
   `CONNECT` is revoked from `PUBLIC`, so one tenant's role cannot open another tenant's DB.
3. Runs tenant migrations (creates tables, seeds roles/permissions), creates the first principal
   (`must_change_password = true`, principal role → OTP at login).
4. Marks the tenant `active`. On any failure it is marked `failed` with the error stored in
   `provisioning_error`; send the same request again to retry (the half-built DB is dropped first).

To move a large school to a dedicated server: restore its DB there, set `db_host` / `db_port` on its row.

## 7. Migration scripts

| Script | What it does |
|---|---|
| `npm run migration:master:generate -- src/migrations/master/<Name>` | Diff master entities vs master DB, write a migration |
| `npm run migration:master:run` | Apply pending master migrations |
| `npm run migration:master:revert` | Undo the last master migration |
| `npm run migration:tenant:generate -- src/migrations/tenant/<Name>` | Diff `*.tenant.entity.ts` vs `tenant_template`, write a migration |
| `npm run migration:tenant:run` | Apply pending tenant migrations to `tenant_template` only |
| `npm run migration:tenants:run-all` | Apply pending tenant migrations to **every** tenant in the registry |
| `npm run migration:master:run:prod` | Production: master migrations from compiled `dist/` |
| `npm run migration:tenants:run-all:prod` | Production: all-tenants runner from compiled `dist/` |

`migration:tenant:run` and `migration:tenants:run-all` are different on purpose: the first only touches the scratch template DB, the second touches real tenant databases.

---

## 8. Development workflows

### A. Change a master entity (e.g. add a column to `Tenant`)

```bash
# 1. edit src/modules/master/tenants/entities/tenant.master.entity.ts
npm run migration:master:generate -- src/migrations/master/AddPlanToTenant
# 2. open the generated file and review the SQL
npm run migration:master:run
# 3. commit the entity change AND the migration file together
```

### B. Add or change a tenant entity (e.g. new `Order` entity)

```bash
# 1. create/edit src/modules/tenant/orders/entities/order.tenant.entity.ts
# 2. make sure tenant_template is up to date first (see workflow D)
npm run migration:tenant:generate -- src/migrations/tenant/CreateOrders
# 3. review the generated file
npm run migration:tenant:run            # apply to tenant_template
npm run migration:tenants:run-all       # apply to your local tenants
# 4. commit the entity AND the migration together
```

If generate says **"No changes in database schema were found"**, then either nothing changed or `tenant_template` already has the change (it was synced or migrated earlier). Recreate `tenant_template` empty and run `migration:tenant:run`.

### C. Creating a tenant

See section 6. New tenants get every migration at creation time.

### D. After pulling teammates' changes

```bash
git pull
npm install
npm run migration:master:run
npm run migration:tenant:run
npm run migration:tenants:run-all
```

Do this every time the pull contains new files in `src/migrations/`.

### E. Reverting a bad migration (development only)

```bash
npm run migration:master:revert         # master
```

For tenant migrations, revert on `tenant_template` with the CLI, then write a new corrective migration. Do not hand-edit migrations that others have already run.

---

## 9. Production deployment

Run order matters. **Migrate first, start the new code after.**

```bash
# 1. Install and build
npm ci
npm run build

# 2. Back up first (master + every tenant DB), e.g. pg_dump per database

# 3. Master schema
npm run migration:master:run:prod

# 4. All tenant schemas (exits non-zero if any tenant failed)
npm run migration:tenants:run-all:prod

# 5. Start the app
node dist/main
```

Notes:

- Steps 3 and 4 run from compiled JavaScript in `dist/`, so no `ts-node` or dev dependencies are needed on the server.
- If step 4 fails for some tenants, the output lists them (`FAIL <slug>: <error>`). Fix the cause and run step 4 again. Already-migrated tenants are skipped, failed ones are retried. Do **not** start the new version until it passes for all tenants.
- Each migration runs in its own transaction (`transaction: 'each'`), so a failing migration rolls back cleanly for that tenant.
- Run migrations from **one place** (CI/CD job or a single release step), never from several app instances at boot.
- New tenants created later automatically get all migrations because `POST /tenants` runs them.

### Zero-downtime rule (expand / contract)

Tenants migrate one at a time, so old and new code can briefly coexist with different schemas. Write migrations so the **previous release still works** against the new schema:

- Add columns as nullable or with a default. Never add a required column without one in the same release.
- To rename or drop: release 1 adds the new column and writes to both, release 2 stops using the old one, release 3 drops it.

---

## 10. Troubleshooting

| Problem | Cause / fix |
|---|---|
| `extension "citext" is not available` | Install the Postgres contrib package (section 2). |
| `permission denied to create database / role` | The DB role lacks `CREATEDB` / `CREATEROLE`. |
| Tenant creation returned 500 | See `tenants.provisioning_error` and the server log; retry the same request. |
| `relation "..." already exists` while running migrations | The DB was created earlier with `synchronize: true`. Recreate it empty and run migrations. |
| Generate produces a huge migration that recreates everything | `tenant_template` is out of date. Run `npm run migration:tenant:run` first. |
| `too many connections` | Lower `TENANT_DB_POOL_MAX` / `TENANT_POOL_MAX_TENANTS`, or put PgBouncer in front. |
| Rate limit counts look wrong behind a load balancer | Set `TRUST_PROXY` to the number of proxies. |
