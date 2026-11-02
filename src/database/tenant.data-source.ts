import 'dotenv/config';
import { DataSource } from 'typeorm';
import { tenantOptions } from './tenant-options';

export default new DataSource(tenantOptions(process.env.TENANT_DB_NAME!));