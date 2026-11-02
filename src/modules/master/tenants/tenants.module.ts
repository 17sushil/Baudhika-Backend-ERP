import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform-auth/platform.module';
import { PublicTenantsController } from './controllers/public-tenants.controller';
import { TenantsController } from './controllers/tenants.controller';
import { TenantBranding } from './entities/tenant-branding.master.entity';
import { Tenant } from './entities/tenant.master.entity';
import { BrandingService } from './services/branding.service';
import { FrontendRevalidateService } from './services/frontend-revalidate.service';
import { TenantProvisioningService } from './services/tenant-provisioning.service';
import { TenantResolverService } from './services/tenant-resolver.service';
import { TenantsService } from './services/tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantBranding]), PlatformModule],
  providers: [
    TenantsService,
    TenantProvisioningService,
    TenantResolverService,
    BrandingService,
    FrontendRevalidateService,
  ],
  controllers: [TenantsController, PublicTenantsController],
  exports: [TenantsService],
})
export class TenantsModule {}
