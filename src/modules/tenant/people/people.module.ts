import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';

@Module({
  imports: [TenantAuthModule, AuditModule],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
})
export class PeopleModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(PersonsController);
  }
}
