import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { decryptSecret } from '../../../common/utils/crypto.util';
import { TenantDbTarget, tenantOptions } from '../../../database/tenant/tenant-options';

/** The connection fields of a tenants row (db_password_enc still encrypted). */
export interface TenantConnectionInfo {
  id: string;
  dbName: string;
  dbHost: string | null;
  dbPort: number | null;
  dbUser: string | null;
  dbPasswordEnc: string | null;
}

interface PoolEntry {
  ds: Promise<DataSource>;
  lastUsed: number;
}

export function toDbTarget(t: TenantConnectionInfo): TenantDbTarget {
  return {
    database: t.dbName,
    host: t.dbHost,
    port: t.dbPort,
    username: t.dbUser,
    password: t.dbPasswordEnc ? decryptSecret(t.dbPasswordEnc) : null,
  };
}

/**
 * One small pool per tenant, kept in an LRU map. Idle tenants are closed so that thousands of
 * tenants don't hold thousands of idle connections. In production put PgBouncer in front too.
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly pools = new Map<string, PoolEntry>();
  private readonly maxPools = +(process.env.TENANT_POOL_MAX_TENANTS ?? 200);
  private readonly idleMs = +(process.env.TENANT_POOL_IDLE_MS ?? 10 * 60_000);
  private readonly sweeper = setInterval(() => void this.sweepIdle(), 60_000).unref();

  get(tenant: TenantConnectionInfo): Promise<DataSource> {
    const hit = this.pools.get(tenant.id);
    if (hit) {
      // Re-insert to mark as most recently used.
      this.pools.delete(tenant.id);
      hit.lastUsed = Date.now();
      this.pools.set(tenant.id, hit);
      return hit.ds;
    }

    const ds = new DataSource(tenantOptions(toDbTarget(tenant)))
      .initialize()
      .catch((e) => {
        this.pools.delete(tenant.id);
        throw e;
      });
    this.pools.set(tenant.id, { ds, lastUsed: Date.now() });
    this.evictOverflow();
    return ds;
  }

  /** Short-lived connection for provisioning / maintenance; never cached. */
  async withDataSource<T>(target: TenantDbTarget, fn: (ds: DataSource) => Promise<T>): Promise<T> {
    const ds = new DataSource(tenantOptions(target, 1));
    await ds.initialize();
    try {
      return await fn(ds);
    } finally {
      await ds.destroy();
    }
  }

  /** Close a tenant's pool, e.g. after its connection details change or before dropping its DB. */
  async evict(tenantId: string) {
    const entry = this.pools.get(tenantId);
    if (!entry) return;
    this.pools.delete(tenantId);
    await this.close(tenantId, entry);
  }

  async onModuleDestroy() {
    clearInterval(this.sweeper);
    await Promise.all([...this.pools].map(([id, e]) => this.close(id, e)));
    this.pools.clear();
  }

  // Only evict pools idle for a while: an in-flight request may still hold a recently used one.
  private evictOverflow() {
    const now = Date.now();
    for (const [id, entry] of this.pools) {
      if (this.pools.size <= this.maxPools) return;
      if (now - entry.lastUsed < 30_000) return; // map is LRU-ordered; the rest are newer
      this.pools.delete(id);
      void this.close(id, entry);
    }
  }

  private async sweepIdle() {
    const cutoff = Date.now() - this.idleMs;
    for (const [id, entry] of this.pools) {
      if (entry.lastUsed > cutoff) break;
      this.pools.delete(id);
      await this.close(id, entry);
    }
  }

  private async close(id: string, entry: PoolEntry) {
    try {
      const ds = await entry.ds;
      if (ds.isInitialized) await ds.destroy();
    } catch (e) {
      this.logger.warn(`Closing pool for tenant ${id} failed: ${(e as Error).message}`);
    }
  }
}
