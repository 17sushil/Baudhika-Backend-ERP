# Multi-Tenant Backend (NestJS + PostgreSQL + TypeORM)

Database-per-tenant architecture. One **master** database holds the tenant registry. Every tenant gets its **own PostgreSQL database**. The tenant is resolved on each request from the `x-tenant-id` header.

All schema changes go through **migrations**. `synchronize` is `false` everywhere and must stay that way.

---

## 1. How it works

```
Request ──> TenantMiddleware ──> reads x-tenant-id, looks it up in master DB
                │
                └─> req.tenant = { slug, dbName, ... }
                         │
                         v
              TENANT_DS (request-scoped provider)
                         │
                         v
          TenantConnectionService.get(dbName)  ──> cached DataSource per tenant
                         │
                         v
                 Service uses ds.getRepository(...)
```

Two databases kinds, two migration sets:

| | Master DB | Tenant DBs |
|---|---|---|
| Contains | `tenants` registry table | All business tables (users, ...) |
| Count | 1 | One per tenant |
| Entities | Explicitly listed (`Tenant`) | Any file named `*.tenant.entity.ts` |
| Migrations folder | `src/migrations/master` | `src/migrations/tenant` |
| Applied by | `migration:master:run` | `migration:tenants:run-all` |

---

## 2. Prerequisites

- Node.js 18+ and npm
- PostgreSQL running locally, plus pgAdmin
- The Postgres role used in `.env` must have `CREATEDB` (the default `postgres` superuser does)

---

## 3. First-time setup (new developer)

```bash
git clone <repo> && cd backend
npm install
cp .env.example .env        # then edit values
```

`.env`:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=yourpassword
MASTER_DB_NAME=master_db
TENANT_DB_NAME=tenant_template
```

In pgAdmin create **two empty databases**:

1. `master_db` : the tenant registry
2. `tenant_template` : a scratch database, only used so TypeORM can compare entities against the current tenant schema when generating migrations. It never holds real data.

Then apply all migrations:

```bash
npm run migration:master:run     # creates the tenants table in master_db
npm run migration:tenant:run     # brings tenant_template up to date
npm run start:dev
```

Create a first tenant to test:

```bash
curl -X POST localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme","slug":"acme"}'
```

pgAdmin will now show a `tenant_acme` database with all tenant tables.

---

## 4. Project structure

```
src/
  database/
    tenant-options.ts          # builds DataSource options for any tenant DB
    master.data-source.ts      # DataSource for master DB (used by CLI + scripts)
    tenant.data-source.ts      # DataSource for tenant_template (CLI only)
    migrate-tenants.ts         # runs pending tenant migrations on ALL tenants
  migrations/
    master/                    # master schema history
    tenant/                    # tenant schema history (applied to every tenant)
  tenant-db/                   # infrastructure only
    tenant-connection.service.ts
    tenant-db.module.ts
    tenant.middleware.ts
  tenants/                     # master DB feature: tenant registry
    tenant.entity.ts
    tenants.service.ts / controller / module
  users/                       # example tenant-scoped feature
    user.tenant.entity.ts      # owned by the feature
    users.service.ts / controller / module
```

---

## 5. Conventions

- **Tenant entity** : file name ends with `.tenant.entity.ts`, placed inside its own feature folder (e.g. `src/orders/order.tenant.entity.ts`). It is discovered automatically. No registration needed.
- **Master entity** : any other `*.entity.ts`. Must be added explicitly to `master.data-source.ts` and `app.module.ts`.
- **Never** put a tenant entity in the master config or the reverse.
- **Never** edit or delete a migration that has been merged/applied elsewhere. Add a new one.
- **Never** use `synchronize: true`.

---

## 6. Migration scripts

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

## 7. Development workflows

### A. Change a master entity (e.g. add a column to `Tenant`)

```bash
# 1. edit src/tenants/tenant.entity.ts
npm run migration:master:generate -- src/migrations/master/AddPlanToTenant
# 2. open the generated file and review the SQL
npm run migration:master:run
# 3. commit the entity change AND the migration file together
```

### B. Add or change a tenant entity (e.g. new `Order` entity)

```bash
# 1. create/edit src/orders/order.tenant.entity.ts
# 2. make sure tenant_template is up to date first (see workflow D)
npm run migration:tenant:generate -- src/migrations/tenant/CreateOrders
# 3. review the generated file
npm run migration:tenant:run            # apply to tenant_template
npm run migration:tenants:run-all       # apply to your local tenants
# 4. commit the entity AND the migration together
```

If generate says **"No changes in database schema were found"**, then either nothing changed or `tenant_template` already has the change (it was synced or migrated earlier). Recreate `tenant_template` empty and run `migration:tenant:run`.

### C. Creating a tenant

`POST /tenants` does, in this order:

1. `CREATE DATABASE tenant_<slug>`
2. Run all tenant migrations on it
3. Save the row in the master `tenants` table

If step 2 fails, the registry row is never saved, but the empty database exists. Drop `tenant_<slug>` in pgAdmin before retrying.

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

## 8. Production deployment

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

## 9. Troubleshooting

| Problem | Cause / fix |
|---|---|
| `database "tenant_x" already exists` on create | A previous create failed after `CREATE DATABASE`. Drop it in pgAdmin and retry. |
| `permission denied to create database` | The DB role lacks `CREATEDB`. |
| `relation "..." already exists` while running migrations | The DB was created earlier with `synchronize: true`. Recreate it empty and run migrations. |
| Generate produces an empty migration or "no changes" | `tenant_template` is already in sync, or the entity file is not named `*.tenant.entity.ts`. |
| Generate produces a huge migration that recreates everything | `tenant_template` is out of date. Run `npm run migration:tenant:run` first. |
| Tenant tables appear in `master_db` (or the reverse) | An entity was registered in the wrong config. Check the suffix convention. |
| `too many connections` | Each tenant pool holds up to 5 connections. Lower `extra.max`, evict idle pools, or put PgBouncer in front. |
| `Cannot find module ... .d.ts` in production | Migration glob matched `.d.ts` files. Use the `.js`-only glob (see `tenant-options.ts`). |