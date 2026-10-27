import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.master.entity';
import { TenantsService } from './services/tenants.service';
import { TenantsController } from './controllers/tenants.controller';
import { PlatformModule } from '../platform/platform.module';
import { BrandingService } from './services/branding.service';
import { FrontendRevalidateService } from './services/frontend-revalidate.service';
import { PublicTenantsController } from './controllers/public-tenants.controller';
import { TenantBranding } from './entities/tenant-branding.master.entity';
import { TenantResolverService } from './services/tenant-resolver.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantBranding]), PlatformModule],
  providers: [
    TenantsService,
    TenantResolverService,
    BrandingService,
    FrontendRevalidateService,
  ],
  controllers: [TenantsController, PublicTenantsController],
  exports: [TenantsService],
})
export class TenantsModule {}
