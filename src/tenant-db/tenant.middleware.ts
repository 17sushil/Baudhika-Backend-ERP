import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenants: TenantsService) {}

  async use(req: any, _res: any, next: () => void) {
    const slug = req.headers['x-tenant-id'];
    if (typeof slug !== 'string') throw new BadRequestException('Missing x-tenant-id');
    const tenant = await this.tenants.findBySlug(slug.toLowerCase());
    if (!tenant) throw new NotFoundException('Tenant not found');
    req.tenant = tenant;
    next();
  }
}