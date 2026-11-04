import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { validateEnv } from './config/env.validation';
import { masterOptions } from './database/master/master-options';
import { PlatformModule } from './modules/master/platform-auth/platform.module';
import { TenantsModule } from './modules/master/tenants/tenants.module';
import { AuditModule } from './modules/tenant/audit/audit.module';
import { TenantAuthModule } from './modules/tenant/auth/tenant-auth.module';
import { TenantDbModule } from './modules/tenant/context/tenant-db.module';
import { DashboardModule } from './modules/tenant/dashboard/dashboard.module';
import { GuardiansModule } from './modules/tenant/guardians/guardians.module';
import { OrganizationModule } from './modules/tenant/organization/organization.module';
import { PeopleModule } from './modules/tenant/people/people.module';
import { RolesModule } from './modules/tenant/roles/roles.module';
import { StaffModule } from './modules/tenant/staff/staff.module';
import { StudentsModule } from './modules/tenant/students/students.module';
import { UsersModule } from './modules/tenant/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({ useFactory: () => masterOptions() }),
    // Per-instance, per-IP. Behind several instances use a shared store (e.g. Redis) for exact limits.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    TenantDbModule,

    // Control plane (master DB)
    PlatformModule,
    TenantsModule,

    // Tenant plane (one DB per school)
    TenantAuthModule,
    UsersModule,
    RolesModule,
    AuditModule,
    OrganizationModule,
    PeopleModule,
    GuardiansModule,
    StudentsModule,
    StaffModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
