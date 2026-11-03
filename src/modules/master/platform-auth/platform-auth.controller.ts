import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AUTH_THROTTLE } from '../../../common/constants/throttle.constants';
import { TokenPairDto } from '../../../common/dto/token-pair.dto';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../../../common/swagger/api-response.decorators';
import { LoginDto } from './dto/login.dto';
import { OtpChallengeDto } from './dto/platform-auth.response.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PlatformAuthService } from './services/platform-auth.service';
import { PlatformTokenService } from './services/platform-token.service';

@ApiTags('Platform Auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private auth: PlatformAuthService,
    private tokens: PlatformTokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Step 1: check password, email a 6-digit OTP', description: 'Rate limit 10/min per IP.' })
  @ApiEnvelope(OtpChallengeDto)
  @ApiErrors({ 400: 'Validation failed', 401: 'Invalid credentials', 429: 'Too many requests' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('verify-otp')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Step 2: verify the OTP, receive tokens', description: '5 attempts, 5 minutes, single use.' })
  @ApiEnvelope(TokenPairDto)
  @ApiErrors({ 400: 'Validation failed', 401: 'Invalid or expired code', 429: 'Too many requests' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.challengeId, dto.code);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Rotate tokens', description: 'Returns a new pair. Reusing an old refresh token revokes the session.' })
  @ApiEnvelope(TokenPairDto)
  @ApiErrors({ 401: 'Invalid refresh token', 429: 'Too many requests' })
  refresh(@Body() dto: RefreshDto) {
    return this.tokens.rotate(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'End the session', description: 'Always 204, even for an unknown token.' })
  @ApiNoContent('Session ended')
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.logout(dto.refreshToken);
  }
}
