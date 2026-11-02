import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../../../common/constants/throttle.constants';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PlatformAuthService } from './services/platform-auth.service';
import { PlatformTokenService } from './services/platform-token.service';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private auth: PlatformAuthService,
    private tokens: PlatformTokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.challengeId, dto.code);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  refresh(@Body() dto: RefreshDto) {
    return this.tokens.rotate(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.logout(dto.refreshToken);
  }
}