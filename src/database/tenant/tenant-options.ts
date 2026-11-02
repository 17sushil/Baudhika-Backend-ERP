import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';
const src = join(__dirname, '..', '..');

/** Where and how to reach one tenant database. Missing fields fall back to the shared DB_* env. */
export interface TenantDbTarget {
  database: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string | null;
}

export function tenantOptions(target: TenantDbTarget, poolMax?: number): DataSourceOptions {
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto', // gen_random_uuid(), built into PG13+
    host: target.host ?? process.env.DB_HOST,
    port: target.port ?? +(process.env.DB_PORT ?? 5432),
    username: target.username ?? process.env.DB_USER,
    password: target.password ?? process.env.DB_PASS,
    database: target.database,
    entities: [join(src, '**', `*.tenant.entity.${ext}`).replace(/\\/g, '/')],
    migrations: [join(src, 'migrations', 'tenant', `*.${ext}`).replace(/\\/g, '/')],
    synchronize: false,
    extra: {
      // Keep per-tenant pools small: N tenants x max must stay below Postgres / PgBouncer limits.
      max: poolMax ?? +(process.env.TENANT_DB_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    },
  };
}
