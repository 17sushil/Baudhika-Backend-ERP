import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'crypto';
import { IsNull } from 'typeorm';
import { safeEqual } from '../../../../common/utils/crypto.util';
import { hashPassword, verifyDummy, verifyPassword } from '../../../../common/utils/password.util';
import { MailService } from '../../../../infra/mail/mail.service';
import { UserStatus } from '../../access/access.enums';
import { AccessService } from '../../access/access.service';
import { User } from '../../access/entities/user.tenant.entity';
import { classifyIdentifier } from '../../access/identifier.util';
import { TenantContext } from '../../context/tenant-context';
import { ClientMeta } from '../auth.types';
import { UserOtpChallenge } from '../entities/user-otp-challenge.tenant.entity';
import { LOCKOUT_SECONDS, LOCKOUT_THRESHOLD, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from '../tenant-auth.constants';
import { TenantTokenService, TokenPair } from './tenant-token.service';

// One message for unknown user, wrong password and locked account: no account enumeration.
const INVALID = 'Invalid credentials. Repeated failures lock the account for 15 minutes.';

export type LoginResult =
  | ({ status: 'authenticated'; mustChangePassword: boolean } & TokenPair)
  | { status: 'otp_required'; challengeId: string; channel: 'email'; destination: string; expiresInSeconds: number };

@Injectable()
export class TenantAuthService {
  private readonly logger = new Logger(TenantAuthService.name);
  private readonly otpKey: string;

  constructor(
    private ctx: TenantContext,
    private tokens: TenantTokenService,
    private access: AccessService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.otpKey = config.getOrThrow<string>('TENANT_JWT_SECRET');
  }

  /** Step 1: password. Returns tokens, or an OTP challenge for MFA users and admin/principal roles. */
  async login(identifier: string, password: string, meta: ClientMeta): Promise<LoginResult> {
    const id = classifyIdentifier(identifier);
    if (!id) {
      await verifyDummy(password);
      throw new UnauthorizedException(INVALID);
    }

    // Soft-deleted users are excluded automatically (@DeleteDateColumn).
    const user = await this.ctx
      .repo(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where(`u.${id.kind} = :v`, { v: id.value })
      .getOne();

    if (!user || (user.lockedUntil && user.lockedUntil > new Date())) {
      await verifyDummy(password);
      throw new UnauthorizedException(INVALID);
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.recordFailure(user.id);
      throw new UnauthorizedException(INVALID);
    }

    // Only someone holding the right password learns the account state.
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Account is not active');

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.ctx.repo(User).update(user.id, { failedLoginCount: 0, lockedUntil: null });
    }

    if (user.mfaEnabled || (await this.access.requiresMfa(user.id))) {
      if (!user.email) {
        this.logger.warn(`MFA required but no email: tenant=${this.ctx.tenant.slug} user=${user.id}`);
        throw new ForbiddenException('Two-step verification needs an email address. Contact your administrator.');
      }
      return this.startOtp(user);
    }

    return { status: 'authenticated', ...(await this.completeLogin(user, meta)) };
  }

  /** Step 2 (MFA only): verify the emailed code, then issue tokens. */
  async verifyOtp(challengeId: string, code: string, meta: ClientMeta): Promise<LoginResult> {
    const now = new Date();
    const otps = this.ctx.repo(UserOtpChallenge);

    // Count the attempt and match only a live, unused, not-exhausted challenge, atomically.
    const res = await otps
      .createQueryBuilder()
      .update()
      .set({ attempts: () => 'attempts + 1' })
      .where('id = :id AND consumed_at IS NULL AND expires_at > :now AND attempts < :max', {
        id: challengeId,
        now,
        max: OTP_MAX_ATTEMPTS,
      })
      .returning('*')
      .execute();

    const row = res.raw[0] as { id: string; user_id: string; code_hash: string } | undefined;
    if (!row || !safeEqual(row.code_hash, this.hashOtp(row.user_id, code))) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const consumed = await otps.update({ id: row.id, consumedAt: IsNull() }, { consumedAt: now });
    if (consumed.affected !== 1) throw new UnauthorizedException('Invalid or expired code');

    const user = await this.ctx.repo(User).findOne({ where: { id: row.user_id } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Invalid or expired code');

    // Receiving the code proves control of the mailbox.
    if (!user.emailVerifiedAt) await this.ctx.repo(User).update(user.id, { emailVerifiedAt: now });

    return { status: 'authenticated', ...(await this.completeLogin(user, meta)) };
  }

  /** Changes the password, ends every other session and returns a fresh pair for this device. */
  async changePassword(userId: string, current: string, next: string, meta: ClientMeta): Promise<TokenPair> {
    const repo = this.ctx.repo(User);
    const user = await repo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOneOrFail();

    if (!(await verifyPassword(user.passwordHash, current))) {
      await this.recordFailure(user.id); // a stolen access token can't brute-force the password
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (current === next) throw new BadRequestException('New password must differ from the current one');

    const passwordHash = await hashPassword(next);
    return this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(User).update(user.id, {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        updatedBy: user.id,
      });
      await this.tokens.revokeAllForUser(user.id, m);
      return this.tokens.issueSession(user.id, meta, m);
    });
  }

  private async completeLogin(user: User, meta: ClientMeta) {
    await this.ctx.repo(User).update(user.id, { lastLoginAt: new Date() });
    const pair = await this.tokens.issueSession(user.id, meta);
    return { ...pair, mustChangePassword: user.mustChangePassword };
  }

  private async startOtp(user: User): Promise<LoginResult> {
    const otps = this.ctx.repo(UserOtpChallenge);
    await otps.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: new Date() }); // one live challenge

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await otps.save(
      otps.create({
        userId: user.id,
        codeHash: this.hashOtp(user.id, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      }),
    );
    await this.mail.sendOtp(user.email!, code, OTP_TTL_MS / 60_000);

    return {
      status: 'otp_required',
      challengeId: challenge.id,
      channel: 'email',
      destination: maskEmail(user.email!),
      expiresInSeconds: OTP_TTL_MS / 1000,
    };
  }

  /** Atomic, so parallel guesses can't skip the lock. Locking also resets the counter. */
  private recordFailure(userId: string) {
    return this.ctx.dataSource.query(
      `UPDATE users SET
         locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN now() + make_interval(secs => $3) ELSE locked_until END,
         failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END
       WHERE id = $1`,
      [userId, LOCKOUT_THRESHOLD, LOCKOUT_SECONDS],
    );
  }

  // Tenant id in the MAC: a code row copied between tenant DBs is useless.
  private hashOtp(userId: string, code: string) {
    return createHmac('sha256', this.otpKey).update(`otp:${this.ctx.tenant.id}:${userId}:${code}`).digest('hex');
  }
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}
