import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TenantAuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(DashboardController);
  }
}
