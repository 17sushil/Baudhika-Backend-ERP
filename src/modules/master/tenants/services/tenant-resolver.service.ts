import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseHost } from '../utils/host.util';
import { buildPublicConfig } from '../public-config';
import { TenantBranding } from '../entities/tenant-branding.master.entity';
import { Tenant, TenantStatus } from '../entities/tenant.master.entity';

@Injectable()
export class TenantResolverService {
  private readonly baseDomain: string;

  constructor(
    @InjectRepository(Tenant) private tenants: Repository<Tenant>,
    @InjectRepository(TenantBranding) private branding: Repository<TenantBranding>,
    config: ConfigService,
  ) {
    this.baseDomain = config.getOrThrow<string>('BASE_DOMAIN').toLowerCase();
  }

  async resolve(rawHost: string) {
    const key = parseHost(rawHost, this.baseDomain);
    if (!key) throw new NotFoundException('Unknown school');

    const tenant = await this.tenants.findOne({
      where: 'slug' in key ? { slug: key.slug } : { customDomain: key.domain },
    });
    if (!tenant) throw new NotFoundException('Unknown school');

    // Suspended schools get a minimal answer so the frontend can show "temporarily unavailable".
    if (tenant.status === TenantStatus.SUSPENDED) {
      return { slug: tenant.slug, status: tenant.status, name: tenant.name };
    }
    // Provisioning and failed tenants look like they don't exist.
    if (tenant.status !== TenantStatus.ACTIVE) throw new NotFoundException('Unknown school');

    const b = await this.branding.findOne({ where: { tenantId: tenant.id } });
    return buildPublicConfig(tenant, b);
  }
}