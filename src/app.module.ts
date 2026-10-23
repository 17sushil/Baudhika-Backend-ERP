import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenants/tenant.entity';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AppService } from './app.service';
import { TenantDbModule } from './tenant-db/tenant-db.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        uuidExtension: 'pgcrypto',
        host: c.get('DB_HOST'),
        port: +c.get('DB_PORT'),
        username: c.get('DB_USER'),
        password: c.get('DB_PASS'),
        database: c.get('MASTER_DB_NAME'),
        // entities: [Tenant],      // master entities only
        // synchronize: true,       // dev only
        entities: [Tenant],
        synchronize: false,
      }),
    }),
    TenantsModule,
    TenantDbModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})  
export class AppModule {}