import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { masterOptions } from './database/master-options';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AppService } from './app.service';
import { TenantDbModule } from './tenant-db/tenant-db.module';
import { AppController } from './app.controller';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => masterOptions() }),
    TenantsModule,
    TenantDbModule,
    UsersModule,
    PlatformModule
  ],
  controllers: [AppController],
  providers: [AppService],
})  
export class AppModule {}