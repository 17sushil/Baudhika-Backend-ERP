import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';
const src = join(__dirname, '..', '..');

export function masterOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto', // gen_random_uuid(), built into PG13+
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.MASTER_DB_NAME,
    entities: [join(src, '**', `*.master.entity.${ext}`).replace(/\\/g, '/')],
    migrations: [join(src, 'migrations', 'master', `*.${ext}`).replace(/\\/g, '/')],
    synchronize: false,
    extra: {
      max: +(process.env.MASTER_DB_POOL_MAX ?? 10),
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    },
  };
}
