import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { clientIp } from '../../../common/utils/client-ip.util';
import { AUTH_THROTTLE } from '../../../common/constants/throttle.constants';
import { TokenPairDto } from '../../../common/dto/token-pair.dto';
import { ApiTenantAuth, ApiTenantHeader } from '../../../common/swagger/api-auth.decorators';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { AllowPendingPasswordChange } from '../access/access.decorators';
import { AccessService } from '../access/access.service';
import type { ClientMeta, TenantRequest } from './auth.types';
import { LoginAuthenticatedDto, LoginOtpRequiredDto, MeDto } from './dto/auth.response.dto';
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
@ApiTags('School Auth')
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
  @ApiTenantHeader()
  @ApiOperation({
    summary: 'Log in with username, email or phone',
    description:
      'Returns tokens, or status otp_required for MFA users and admin/principal roles (then call verify-otp). ' +
      '5 wrong passwords lock the account for 15 minutes. Rate limit 10/min per IP.',
  })
  @ApiEnvelope([LoginAuthenticatedDto, LoginOtpRequiredDto])
  @ApiErrors({
    400: 'Validation failed',
    401: 'Invalid credentials (also for unknown or locked accounts)',
    403: 'Account is not active, or OTP required but no email on file',
    429: 'Too many requests',
  })
  login(@Body() dto: TenantLoginDto, @Req() req: Request) {
    return this.auth.login(dto.identifier, dto.password, meta(req));
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiTenantHeader()
  @ApiOperation({ summary: 'Verify the emailed OTP, receive tokens', description: '5 attempts, 5 minutes, single use.' })
  @ApiEnvelope(LoginAuthenticatedDto)
  @ApiErrors({ 400: 'Validation failed', 401: 'Invalid or expired code', 429: 'Too many requests' })
  verifyOtp(@Body() dto: TenantVerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyOtp(dto.challengeId, dto.code, meta(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiTenantHeader()
  @ApiOperation({ summary: 'Rotate tokens', description: 'Reusing an old refresh token revokes the whole session.' })
  @ApiEnvelope(TokenPairDto)
  @ApiErrors({ 401: 'Invalid refresh token', 429: 'Too many requests' })
  refresh(@Body() dto: TenantRefreshDto, @Req() req: Request) {
    return this.tokens.rotate(dto.refreshToken, meta(req));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiTenantHeader()
  @ApiOperation({ summary: 'End the session', description: 'Always 204.' })
  @ApiNoContent('Session ended')
  async logout(@Body() dto: TenantRefreshDto) {
    await this.tokens.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(TenantAuthGuard)
  @AllowPendingPasswordChange()
  @ApiTenantAuth()
  @ApiOperation({ summary: 'Current user, roles and permissions', description: 'Works while a password change is pending.' })
  @ApiEnvelope(MeDto)
  async me(@Req() req: TenantRequest) {
    const u = req.auth.user;
    const [roles, permissions, [person]] = await Promise.all([
      this.access.roles([u.id]),
      this.access.institutionPermissions(u.id),
      this.access.linkedPerson(u.id),
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
      person: person ?? null,
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(TenantAuthGuard)
  @AllowPendingPasswordChange()
  @Throttle(AUTH_THROTTLE)
  @ApiTenantAuth()
  @ApiOperation({
    summary: 'Change own password',
    description: 'Ends every other session and returns a new token pair for this device. Works while a change is pending.',
  })
  @ApiEnvelope(TokenPairDto)
  @ApiErrors({ 400: 'Weak password, or same as current', 401: 'Current password is incorrect' })
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: TenantRequest) {
    return this.auth.changePassword(req.auth.userId, dto.currentPassword, dto.newPassword, meta(req));
  }
}
