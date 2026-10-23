import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export function tenantOptions(dbName: string): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    // entities: [join(__dirname, '..', 'tenant-db', 'entities', '*.entity.{ts,js}')],
    entities: [join(__dirname, '..', '**', '*.tenant.entity.{ts,js}')],
    // migrations: [join(__dirname, '..', 'migrations', 'tenant', '*.{ts,js}')],
    uuidExtension: 'pgcrypto',
    migrations: [join(__dirname, '..', 'migrations', 'tenant', `*.${ext}`)],
    synchronize: false,
    extra: { max: 5 },
  };
}