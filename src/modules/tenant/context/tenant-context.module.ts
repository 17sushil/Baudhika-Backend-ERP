import { Module } from '@nestjs/common';
import { TenantsModule } from '../../master/tenants/tenants.module';
import { TenantMiddleware } from './tenant.middleware';

/**
 * Import into every tenant-plane module and apply TenantMiddleware to its controllers:
 *   configure(c: MiddlewareConsumer) { c.apply(TenantMiddleware).forRoutes(MyController); }
 */
@Module({
  imports: [TenantsModule],
  providers: [TenantMiddleware],
  exports: [TenantsModule, TenantMiddleware],
})
export class TenantContextModule {}
