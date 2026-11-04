import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [TenantAuthModule, AuditModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(RolesController);
  }
}
