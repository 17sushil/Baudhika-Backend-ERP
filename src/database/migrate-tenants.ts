import 'dotenv/config';
import { DataSource } from 'typeorm';
import masterDs from './master.data-source';
import { tenantOptions } from './tenant-options';

async function main() {
  await masterDs.initialize();
  const tenants: { slug: string; db_name: string }[] = await masterDs.query(
    'SELECT slug, db_name FROM tenants',
  );

  let failed = 0;
  for (const t of tenants) {
    const ds = new DataSource(tenantOptions(t.db_name));
    try {
      await ds.initialize();
      const ran = await ds.runMigrations({ transaction: 'each' });
      console.log(`OK   ${t.slug}: ${ran.length} applied`);
    } catch (e: any) {
      failed++;
      console.error(`FAIL ${t.slug}: ${e.message}`);
    } finally {
      if (ds.isInitialized) await ds.destroy();
    }
  }

  await masterDs.destroy();
  process.exit(failed ? 1 : 0);
}

main();