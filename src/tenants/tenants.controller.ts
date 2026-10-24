import { TenantsService } from './tenants.service';
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PlatformAuthGuard } from '../platform/platform-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenants')
@UseGuards(PlatformAuthGuard)
export class TenantsController {
  constructor(private svc: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.svc.create(dto.name, dto.slug, req.platformUser.id);
  }
}