import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiEnvelope, ApiErrors } from '../../../../common/swagger/api-response.decorators';
import { ResolveQueryDto } from '../dto/resolve-query.dto';
import { PublicTenantConfigDto } from '../dto/tenant.response.dto';
import { TenantResolverService } from '../services/tenant-resolver.service';

@ApiTags('Public')
@Controller('public/tenants')
export class PublicTenantsController {
  constructor(private resolver: TenantResolverService) {}

  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve a host to a school and its theme',
    description: 'For the frontend. Suspended schools return only slug, status and name. Cached 60 s (Cache-Control).',
  })
  @ApiEnvelope(PublicTenantConfigDto)
  @ApiErrors({ 404: 'Unknown school' })
  async resolve(@Query() q: ResolveQueryDto, @Res({ passthrough: true }) res: Response) {
    const config = await this.resolver.resolve(q.host);
    // Set only on success, so a 404 for a not-yet-created school isn't cached.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return config;
  }
}
