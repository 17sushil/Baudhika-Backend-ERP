import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { EntityManager, IsNull } from 'typeorm';
import { parseOpaqueToken, safeEqual, sha256 } from '../../../../common/utils/crypto.util';
import { UserStatus } from '../../access/access.enums';
import { User } from '../../access/entities/user.tenant.entity';
import { TenantContext } from '../../context/tenant-context';
import { ClientMeta } from '../auth.types';
import { UserSession } from '../entities/user-session.tenant.entity';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS, SESSION_MAX_MS, TENANT_JWT_AUDIENCE } from '../tenant-auth.constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface TenantAccessPayload {
  sub: string; // users.id
  sid: string; // user_sessions.family_id
  tid: string; // tenants.id: binds the token to one tenant
}

type RotateResult = { pair: TokenPair | null; reuse: { userId: string; familyId: string } | null };

/** Access JWT + rotating opaque refresh token, stored in the tenant's own user_sessions table. */
@Injectable()
export class TenantTokenService {
  private readonly logger = new Logger(TenantTokenService.name);
  private readonly secret: string;

  constructor(
    private ctx: TenantContext,
    private jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('TENANT_JWT_SECRET');
  }

  async verifyAccess(token: string): Promise<TenantAccessPayload> {
    // Secret, algorithm and audience are pinned explicitly: a platform token can never pass here.
    return this.jwt.verifyAsync<TenantAccessPayload>(token, {
      secret: this.secret,
      algorithms: ['HS256'],
      audience: TENANT_JWT_AUDIENCE,
    });
  }

  /** Starts a brand-new session (token family) after a complete login. */
  async issueSession(userId: string, meta: ClientMeta, m?: EntityManager): Promise<TokenPair> {
    const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_MS);
    const { pair } = await this.issue(m ?? this.ctx.dataSource.manager, userId, randomUUID(), sessionExpiresAt, meta);
    return pair;
  }

  /** Swap a refresh token for a new pair. Presenting a rotated token again revokes the session. */
  async rotate(raw: string, meta: ClientMeta): Promise<TokenPair> {
    const parsed = parseOpaqueToken(raw);
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');

    // Never throw inside the transaction: that would roll back a family revocation.
    const result = await this.ctx.dataSource.transaction<RotateResult>(async (m) => {
      const repo = m.getRepository(UserSession);
      const row = await repo.findOne({ where: { id: parsed.id }, lock: { mode: 'pessimistic_write' } });
      if (!row || !safeEqual(row.tokenHash, sha256(parsed.secret))) return { pair: null, reuse: null };

      const now = new Date();
      if (row.revokedAt) {
        if (row.replacedById) {
          await this.revokeFamily(m, row.familyId, now);
          return { pair: null, reuse: { userId: row.userId, familyId: row.familyId } };
        }
        return { pair: null, reuse: null };
      }
      if (row.expiresAt <= now || row.sessionExpiresAt <= now) return { pair: null, reuse: null };

      const user = await m.getRepository(User).findOne({ where: { id: row.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        await this.revokeFamily(m, row.familyId, now);
        return { pair: null, reuse: null };
      }

      const next = await this.issue(m, row.userId, row.familyId, row.sessionExpiresAt, meta);
      row.revokedAt = now;
      row.replacedById = next.id;
      await repo.save(row);
      return { pair: next.pair, reuse: null };
    });

    if (result.reuse) {
      this.logger.warn(
        `Refresh token reuse: tenant=${this.ctx.tenant.slug} user=${result.reuse.userId} family=${result.reuse.familyId}`,
      );
    }
    if (!result.pair) throw new UnauthorizedException('Invalid refresh token');
    return result.pair;
  }

  /** Ends the session the refresh token belongs to. Silent on bad input. */
  async logout(raw: string) {
    const parsed = parseOpaqueToken(raw);
    if (!parsed) return;
    const repo = this.ctx.repo(UserSession);
    const row = await repo.findOne({ where: { id: parsed.id } });
    if (!row || !safeEqual(row.tokenHash, sha256(parsed.secret))) return;
    await this.revokeFamily(this.ctx.dataSource.manager, row.familyId);
  }

  /** Logs the user out everywhere: password change/reset, suspension. */
  revokeAllForUser(userId: string, m: EntityManager = this.ctx.dataSource.manager) {
    return m.getRepository(UserSession).update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async issue(m: EntityManager, userId: string, familyId: string, sessionExpiresAt: Date, meta: ClientMeta) {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(Date.now() + REFRESH_TTL_MS, sessionExpiresAt.getTime()));
    const repo = m.getRepository(UserSession);
    const row = await repo.save(
      repo.create({
        familyId,
        userId,
        tokenHash: sha256(secret),
        expiresAt,
        sessionExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      }),
    );
    const payload: TenantAccessPayload = { sub: userId, sid: familyId, tid: this.ctx.tenant.id };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.secret,
      algorithm: 'HS256',
      audience: TENANT_JWT_AUDIENCE,
      expiresIn: ACCESS_TTL_SECONDS,
    });
    const pair: TokenPair = {
      accessToken,
      refreshToken: `${row.id}.${secret}`,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_SECONDS,
    };
    return { id: row.id, pair };
  }

  private revokeFamily(m: EntityManager, familyId: string, at = new Date()) {
    return m.getRepository(UserSession).update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }
}
