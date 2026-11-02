import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.master.entity';

const ROUTING_TTL_MS = 30_000;
const NEGATIVE_TTL_MS = 10_000;
const CACHE_MAX = 10_000;

type CacheEntry = { value: Tenant | null; expires: number };

/** Safe shape for API responses: no connection details, no secrets. */
export function toTenantView(t: Tenant) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    customDomain: t.customDomain,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

@Injectable()
export class TenantsService {
  // Per-instance cache: every tenant request needs this lookup, so it must not hit the master DB
  // each time. Staleness is bounded by the TTL across instances; this instance invalidates on writes.
  private readonly routing = new Map<string, CacheEntry>();

  constructor(@InjectRepository(Tenant) private repo: Repository<Tenant>) {}

  findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  /** Tenant incl. its encrypted DB credentials, for opening its connection. Cached. */
  async findForRouting(slug: string): Promise<Tenant | null> {
    const key = `slug:${slug}`;
    const hit = this.routing.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;

    const tenant = await this.repo
      .createQueryBuilder('t')
      .addSelect('t.dbPasswordEnc')
      .where('t.slug = :slug', { slug })
      .getOne();
    this.remember(key, tenant);
    return tenant;
  }

  /** Used by CORS to allow a school's own domain. Cached, active tenants only. */
  async isActiveCustomDomain(domain: string): Promise<boolean> {
    const key = `domain:${domain}`;
    let hit = this.routing.get(key);
    if (!hit || hit.expires <= Date.now()) {
      const tenant = await this.repo.findOne({ where: { customDomain: domain } });
      this.remember(key, tenant);
      hit = this.routing.get(key)!;
    }
    return hit.value?.status === TenantStatus.ACTIVE;
  }

  invalidate(tenant: Pick<Tenant, 'slug' | 'customDomain'>) {
    this.routing.delete(`slug:${tenant.slug}`);
    if (tenant.customDomain) this.routing.delete(`domain:${tenant.customDomain}`);
  }

  async list() {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map(toTenantView);
  }

  private remember(key: string, value: Tenant | null) {
    // Crude bound so random-slug floods can't grow memory without limit.
    if (this.routing.size >= CACHE_MAX) this.routing.clear();
    this.routing.set(key, { value, expires: Date.now() + (value ? ROUTING_TTL_MS : NEGATIVE_TTL_MS) });
  }
}
