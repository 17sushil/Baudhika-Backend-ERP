import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard, type PlatformRequest } from '../../platform-auth/platform-auth.guard';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateBrandingDto } from '../dto/update-branding.dto';
import { BrandingService } from '../services/branding.service';
import { TenantProvisioningService } from '../services/tenant-provisioning.service';
import { TenantsService } from '../services/tenants.service';

@Controller('tenants')
@UseGuards(PlatformAuthGuard)
export class TenantsController {
  constructor(
    private svc: TenantsService,
    private provisioning: TenantProvisioningService,
    private branding: BrandingService,
  ) {}

  @Get()
  list() {
    return this.svc.list();
  }

  /** Creates the tenant and its first admin. Retrying with the same slug resumes a failed attempt. */
  @Post()
  create(@Body() dto: CreateTenantDto, @Req() req: PlatformRequest) {
    return this.provisioning.create(dto, req.platformUser.id);
  }

  @Put(':id/branding')
  publishBranding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingDto,
    @Req() req: PlatformRequest,
  ) {
    return this.branding.publish(id, dto, req.platformUser.id);
  }
}
