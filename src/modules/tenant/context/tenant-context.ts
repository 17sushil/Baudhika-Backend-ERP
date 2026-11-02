import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

/** Public facts about the tenant of the current request. No connection secrets. */
export interface RequestTenant {
  id: string;
  slug: string;
  name: string;
}

interface TenantStore {
  tenant: RequestTenant;
  dataSource: DataSource;
}

/**
 * Per-request tenant scope backed by AsyncLocalStorage. Replaces a REQUEST-scoped provider,
 * which would force every dependent service to be re-instantiated on every request.
 */
@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  get tenant(): RequestTenant {
    return this.store().tenant;
  }

  get dataSource(): DataSource {
    return this.store().dataSource;
  }

  repo<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    return this.store().dataSource.getRepository(entity);
  }

  private store(): TenantStore {
    const s = this.als.getStore();
    // Fails closed: a tenant route without TenantMiddleware must never fall through to some default DB.
    if (!s) throw new InternalServerErrorException('Tenant context missing');
    return s;
  }
}
