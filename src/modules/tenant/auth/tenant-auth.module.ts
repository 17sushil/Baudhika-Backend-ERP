import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../../infra/mail/mail.module';
import { AccessModule } from '../access/access.module';
import { TenantContextModule } from '../context/tenant-context.module';
import { TenantMiddleware } from '../context/tenant.middleware';
import { TenantAuthService } from './services/tenant-auth.service';
import { TenantTokenService } from './services/tenant-token.service';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthGuard } from './tenant-auth.guard';

@Module({
  // Secret/audience are passed per call in TenantTokenService, never taken from module defaults.
  imports: [TenantContextModule, AccessModule, MailModule, JwtModule.register({})],
  controllers: [TenantAuthController],
  providers: [TenantAuthService, TenantTokenService, TenantAuthGuard],
  exports: [TenantTokenService, TenantAuthGuard, AccessModule, TenantContextModule],
})
export class TenantAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes(TenantAuthController);
  }
}
