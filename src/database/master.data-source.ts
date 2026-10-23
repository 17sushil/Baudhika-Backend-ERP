import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

const ext = __filename.endsWith('.ts') ? 'ts' : 'js';


export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.MASTER_DB_NAME,
  entities: [Tenant],
  // migrations: [join(__dirname, '..', 'migrations', 'master', '*.{ts,js}')],
  uuidExtension: 'pgcrypto',
  migrations: [join(__dirname, '..', 'migrations', 'master', `*.${ext}`)],
  synchronize: false,
});