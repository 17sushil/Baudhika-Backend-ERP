import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuditEvent } from './entities/platform-audit-event.master.entity';
import { PlatformAuditService } from './services/platform-audit.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './services/platform-auth.service';
import { PlatformUser } from './entities/platform-user.master.entity';
import { MailModule } from '../mail/mail.module';
import { ACCESS_TTL_SECONDS } from './platform-auth.constants';
import { PlatformOtpChallenge } from './entities/platform-otp-challenge.master.entity';
import { PlatformRefreshToken } from './entities/platform-refresh-token.master.entity';
import { PlatformTokenService } from './services/platform-token.service';

@Module({
  imports: [
    MailModule,
    TypeOrmModule.forFeature([
      PlatformUser,
      PlatformAuditEvent,
      PlatformOtpChallenge,
      PlatformRefreshToken,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow<string>('PLATFORM_JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformTokenService,
    PlatformAuditService,
    PlatformAuthGuard,
  ],
  exports: [
    JwtModule,
    TypeOrmModule,
    PlatformAuditService,
    PlatformTokenService,
    PlatformAuthGuard,
  ],
})
export class PlatformModule {}
