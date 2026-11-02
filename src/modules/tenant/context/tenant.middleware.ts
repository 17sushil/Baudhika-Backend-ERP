import { ForbiddenException, Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantStatus } from '../../master/tenants/entities/tenant.master.entity';
import { TenantsService } from '../../master/tenants/services/tenants.service';
import { isValidSlug } from '../../master/tenants/utils/host.util';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantContext } from './tenant-context';

export const TENANT_HEADER = 'x-tenant-id';

/**
 * Resolves the tenant from the x-tenant-id header and opens its database scope.
 * The header alone grants nothing: every tenant access token carries the tenant id and
 * TenantAuthGuard rejects a token presented to a different tenant.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private tenants: TenantsService,
    private connections: TenantConnectionService,
    private ctx: TenantContext,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const raw = req.headers[TENANT_HEADER];
    const slug = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    // Validate before touching the DB, and answer unknown/invalid alike to avoid slug probing.
    if (!isValidSlug(slug)) throw new NotFoundException('Unknown school');

    const tenant = await this.tenants.findForRouting(slug);
    if (!tenant || tenant.status === TenantStatus.PROVISIONING || tenant.status === TenantStatus.FAILED) {
      throw new NotFoundException('Unknown school');
    }
    if (tenant.status !== TenantStatus.ACTIVE) throw new ForbiddenException('School is temporarily unavailable');

    const dataSource = await this.connections.get(tenant);
    const publicTenant = { id: tenant.id, slug: tenant.slug, name: tenant.name };
    (req as Request & { tenant?: typeof publicTenant }).tenant = publicTenant;
    this.ctx.run({ tenant: publicTenant, dataSource }, () => next());
  }
}
