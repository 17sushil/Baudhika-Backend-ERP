import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { createHmac, randomInt } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { MailService } from '../../mail/mail.service';
import { safeEqual } from '../crypto.util';
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '../platform-auth.constants';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformOtpChallenge } from '../entities/platform-otp-challenge.master.entity';
import { PlatformTokenService } from './platform-token.service';
import { PlatformUser } from '../entities/platform-user.master.entity';

@Injectable()
export class PlatformAuthService {
  private readonly secret: string;

  constructor(
    @InjectRepository(PlatformUser) private users: Repository<PlatformUser>,
    @InjectRepository(PlatformOtpChallenge) private otps: Repository<PlatformOtpChallenge>,
    private audit: PlatformAuditService,
    private mail: MailService,
    private tokens: PlatformTokenService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('PLATFORM_JWT_SECRET');
  }

  /** Step 1: check the password, then send an OTP. No tokens yet. */
  async login(email: string, password: string) {
    email = email.toLowerCase();
    const user = await this.users.findOne({ where: { email } });

    // Always do one hash operation, so response time doesn't reveal whether the email exists.
    const ok =
      user && user.isActive
        ? await argon2.verify(user.passwordHash, password)
        : (await argon2.hash(password), false);

    if (!user || !ok) {
      await this.audit.record({ action: 'platform.login_failed', metadata: { email } });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Only one live challenge per user.
    await this.otps.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: new Date() });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await this.otps.save(
      this.otps.create({
        userId: user.id,
        codeHash: this.hashOtp(user.id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      }),
    );

    await this.mail.sendOtp(user.email, code, OTP_TTL_MS / 60000);
    await this.audit.record({ actorId: user.id, action: 'platform.otp_sent' });
    return { challengeId: challenge.id, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  /** Step 2: verify the OTP. Only now are tokens issued. */
  async verifyOtp(challengeId: string, code: string) {
    const now = new Date();

    // One atomic statement: count this attempt, and only match a live, unused, not-exhausted challenge.
    const res = await this.otps
      .createQueryBuilder()
      .update()
      .set({ attempts: () => 'attempts + 1' })
      .where(
        'id = :id AND consumed_at IS NULL AND expires_at > :now AND attempts < :max',
        { id: challengeId, now, max: OTP_MAX_ATTEMPTS },
      )
      .returning('*')
      .execute();

    const row = res.raw[0] as { id: string; user_id: string; code_hash: string } | undefined;
    if (!row) throw new UnauthorizedException('Invalid or expired code');

    if (!safeEqual(row.code_hash, this.hashOtp(row.user_id, code))) {
      await this.audit.record({ actorId: row.user_id, action: 'platform.otp_failed' });
      throw new UnauthorizedException('Invalid or expired code');
    }

    // Single use, even under concurrent requests.
    const consumed = await this.otps.update({ id: row.id, consumedAt: IsNull() }, { consumedAt: now });
    if (consumed.affected !== 1) throw new UnauthorizedException('Invalid or expired code');

    const user = await this.users.findOne({ where: { id: row.user_id } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid or expired code');

    await this.audit.record({ actorId: user.id, action: 'platform.login' });
    return this.tokens.issueSession(user.id);
  }

  private hashOtp(userId: string, code: string) {
    return createHmac('sha256', this.secret).update(`otp:${userId}:${code}`).digest('hex');
  }
}