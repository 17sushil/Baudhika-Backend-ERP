import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ResolveQueryDto } from '../dto/resolve-query.dto';
import { TenantResolverService } from '../services/tenant-resolver.service';

@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private resolver: TenantResolverService) {}

  @Get('resolve')
  async resolve(@Query() q: ResolveQueryDto, @Res({ passthrough: true }) res: Response) {
    const config = await this.resolver.resolve(q.host);
    // Set only on success, so a 404 for a not-yet-created school isn't cached.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return config;
  }
}