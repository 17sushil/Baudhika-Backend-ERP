import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from '../../../common/utils/client-ip.util';
import { AUTH_THROTTLE } from '../../../common/constants/throttle.constants';
import { AllowPendingPasswordChange } from '../access/access.decorators';
import { AccessService } from '../access/access.service';
import type { ClientMeta, TenantRequest } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TenantLoginDto } from './dto/login.dto';
import { TenantRefreshDto } from './dto/refresh.dto';
import { TenantVerifyOtpDto } from './dto/verify-otp.dto';
import { TenantAuthService } from './services/tenant-auth.service';
import { TenantTokenService } from './services/tenant-token.service';
import { TenantAuthGuard } from './tenant-auth.guard';

const meta = (req: Request): ClientMeta => ({
  ip: clientIp(req),
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
});

/** School user authentication. Every route needs the x-tenant-id header. */
@Controller('auth')
export class TenantAuthController {
  constructor(
    private auth: TenantAuthService,
    private tokens: TenantTokenService,
    private access: AccessService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: TenantLoginDto, @Req() req: Request) {
    return this.auth.login(dto.identifier, dto.password, meta(req));
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  verifyOtp(@Body() dto: TenantVerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto.challengeId, dto.code, meta(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  refresh(@Body() dto: TenantRefreshDto, @Req() req: Request) {
    return this.tokens.rotate(dto.refreshToken, meta(req));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: TenantRefreshDto) {
    await this.tokens.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(TenantAuthGuard)
  @AllowPendingPasswordChange()
  async me(@Req() req: TenantRequest) {
    const u = req.auth.user;
    const [roles, permissions] = await Promise.all([
      this.access.roles([u.id]),
      this.access.institutionPermissions(u.id),
    ]);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone,
      locale: u.locale,
      mfaEnabled: u.mfaEnabled,
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: u.lastLoginAt,
      roles: roles.get(u.id) ?? [],
      permissions: [...permissions].sort(),
      tenant: { slug: req.tenant.slug, name: req.tenant.name },
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(TenantAuthGuard)
  @AllowPendingPasswordChange()
  @Throttle(AUTH_THROTTLE)
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: TenantRequest) {
    return this.auth.changePassword(req.auth.userId, dto.currentPassword, dto.newPassword, meta(req));
  }
}
