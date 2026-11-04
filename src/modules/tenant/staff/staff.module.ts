import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { OrganizationModule } from '../organization/organization.module';
import { PeopleModule } from '../people/people.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [TenantAuthModule, AuditModule, PeopleModule, OrganizationModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(StaffController);
  }
}
