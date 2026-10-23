import { Injectable, OnModuleDestroy } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
// import { join } from 'path';
import { tenantOptions } from '../database/tenant-options';

@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private pools = new Map<string, Promise<DataSource>>();

//   constructor(private config: ConfigService) {}

  get(dbName: string): Promise<DataSource> {
    let p = this.pools.get(dbName);
    if (!p) {
    //   p = new DataSource({
    //     type: 'postgres',
    //     host: this.config.get('DB_HOST'),
    //     port: +this.config.get('DB_PORT'),
    //     username: this.config.get('DB_USER'),
    //     password: this.config.get('DB_PASS'),
    //     database: dbName,
    //     entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
    //     synchronize: true,          // dev only; use migrations in prod
    //     extra: { max: 5 },          // keep per-tenant pools small
    //   })
          p = new DataSource(tenantOptions(dbName))
        .initialize()
        .catch((e) => { this.pools.delete(dbName); throw e; });
      this.pools.set(dbName, p);
    }
    return p;
  }

  async migrate(dbName: string) {
    const ds = await this.get(dbName);
    return ds.runMigrations({ transaction: 'each' });
  }

  async onModuleDestroy() {
    for (const p of this.pools.values()) await (await p).destroy();
  }
}