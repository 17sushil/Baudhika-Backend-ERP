import { TenantsService } from '../services/tenants.service';
// import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { BrandingService } from '../services/branding.service';
import { UpdateBrandingDto } from '../dto/update-branding.dto';
import { PlatformAuthGuard } from '../../platform/platform-auth.guard';
import { CreateTenantDto } from '../dto/create-tenant.dto';

@Controller('tenants')
@UseGuards(PlatformAuthGuard)
export class TenantsController {
  constructor(
    private svc: TenantsService,
    private branding: BrandingService
  ) {}

  @Get()
  list(){
    return this.svc.list();
  }

  @Put(':id/branding')
  publishBranding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandingDto,
    @Req() req: any,
  ){
    return this.branding.publish(id, dto, req.platformUser.id)
  }

  @Post()
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.svc.create(dto.name, dto.slug, req.platformUser.id);
  }
}