import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export function masterOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.MASTER_DB_NAME,
    entities: [join(__dirname, '..', '**', `*.master.entity.${ext}`).replace(/\\/g, '/')],
    migrations: [join(__dirname, '..', 'migrations', 'master', `*.${ext}`).replace(/\\/g, '/')],
    synchronize: false,
  };
}