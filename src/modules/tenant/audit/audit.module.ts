import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [TenantAuthModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(AuditController);
  }
}
