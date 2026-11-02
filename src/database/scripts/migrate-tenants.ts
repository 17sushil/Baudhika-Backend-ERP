import 'dotenv/config';
import { DataSource } from 'typeorm';
import masterDs from '../master/master.data-source';
import { tenantOptions } from '../tenant/tenant-options';
import { toDbTarget, TenantConnectionInfo } from '../../modules/tenant/context/tenant-connection.service';

/**
 * Applies pending tenant migrations to every live tenant.
 * The first tenant runs alone as a canary; the rest run in parallel batches (MIGRATION_CONCURRENCY).
 */
async function migrate(t: TenantConnectionInfo & { slug: string }) {
  const ds = new DataSource(tenantOptions(toDbTarget(t), 1));
  try {
    await ds.initialize();
    const ran = await ds.runMigrations({ transaction: 'each' });
    console.log(`OK   ${t.slug}: ${ran.length} applied`);
    return true;
  } catch (e: any) {
    console.error(`FAIL ${t.slug}: ${e.message}`);
    return false;
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}

async function main() {
  await masterDs.initialize();
  const tenants: (TenantConnectionInfo & { slug: string })[] = await masterDs.query(
    `SELECT id, slug, db_name AS "dbName", db_host AS "dbHost", db_port AS "dbPort",
            db_user AS "dbUser", db_password_enc AS "dbPasswordEnc"
       FROM tenants WHERE status IN ('active', 'suspended') ORDER BY created_at`,
  );
  await masterDs.destroy();

  const concurrency = Math.max(1, +(process.env.MIGRATION_CONCURRENCY ?? 4));
  const [canary, ...rest] = tenants;
  let failed = 0;

  if (canary && !(await migrate(canary))) {
    console.error('Canary tenant failed; not touching the others.');
    process.exit(1);
  }
  for (let i = 0; i < rest.length; i += concurrency) {
    const results = await Promise.all(rest.slice(i, i + concurrency).map(migrate));
    failed += results.filter((ok) => !ok).length;
  }

  console.log(`Done: ${tenants.length - failed}/${tenants.length} tenants up to date.`);
  process.exit(failed ? 1 : 0);
}

void main();
