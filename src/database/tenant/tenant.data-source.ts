import 'dotenv/config';
import { DataSource } from 'typeorm';
import { tenantOptions } from './tenant-options';

// CLI only: generates tenant migrations against the empty template database.
export default new DataSource(tenantOptions({ database: process.env.TENANT_DB_NAME! }));
