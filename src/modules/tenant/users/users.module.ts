import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TenantAuthModule } from '../auth/tenant-auth.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TenantAuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(UsersController);
  }
}
