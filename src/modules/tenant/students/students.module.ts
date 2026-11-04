import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { GuardiansModule } from '../guardians/guardians.module';
import { OrganizationModule } from '../organization/organization.module';
import { PeopleModule } from '../people/people.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [TenantAuthModule, AuditModule, PeopleModule, GuardiansModule, OrganizationModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(StudentsController);
  }
}
