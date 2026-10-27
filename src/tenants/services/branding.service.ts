import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAuditService } from '../../platform/services/platform-audit.service';
import { FrontendRevalidateService } from './frontend-revalidate.service';
import { UpdateBrandingDto } from '../dto/update-branding.dto';
import { BRANDING_DEFAULTS, buildPublicConfig } from '../public-config';
import { TenantBranding } from '../entities/tenant-branding.master.entity';
import { Tenant } from '../entities/tenant.master.entity';

@Injectable()
export class BrandingService {
  private readonly baseDomain: string;

  constructor(
    @InjectRepository(Tenant) private tenants: Repository<Tenant>,
    @InjectRepository(TenantBranding) private repo: Repository<TenantBranding>,
    private audit: PlatformAuditService,
    private frontend: FrontendRevalidateService,
    config: ConfigService,
  ) {
    this.baseDomain = config.getOrThrow<string>('BASE_DOMAIN').toLowerCase();
  }

  /** PUT semantics: fields left out are reset to their defaults. */
  async publish(tenantId: string, dto: UpdateBrandingDto, actorId: string) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const saved = await this.repo.save(
      this.repo.create({
        tenantId,
        displayName: dto.displayName,
        shortName: dto.shortName ?? null,
        description: dto.description ?? null,
        logoUrl: dto.logoUrl ?? null,
        faviconUrl: dto.faviconUrl ?? null,
        primaryColor: (dto.primaryColor ?? BRANDING_DEFAULTS.primaryColor).toUpperCase(),
        secondaryColor: (dto.secondaryColor ?? BRANDING_DEFAULTS.secondaryColor).toUpperCase(),
        language: dto.language ?? BRANDING_DEFAULTS.language,
      }),
    );

    await this.audit.record({
      actorId,
      action: 'branding.publish',
      targetType: 'tenant',
      targetId: tenant.id,
    });

    const hosts = [`${tenant.slug}.${this.baseDomain}`];
    if (tenant.customDomain) hosts.push(tenant.customDomain);
    void this.frontend.revalidateHosts(hosts); // fire and forget

    return buildPublicConfig(tenant, saved);
  }
}