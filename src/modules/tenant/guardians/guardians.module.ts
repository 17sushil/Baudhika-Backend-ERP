import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { PeopleModule } from '../people/people.module';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  imports: [TenantAuthModule, AuditModule, PeopleModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(GuardiansController);
  }
}
