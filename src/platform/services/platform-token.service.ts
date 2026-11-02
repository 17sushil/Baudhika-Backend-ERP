import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { safeEqual, sha256 } from '../crypto.util';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS, SESSION_MAX_MS } from '../platform-auth.constants';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformRefreshToken } from '../entities/platform-refresh-token.master.entity';
import { PlatformUser } from '../entities/platform-user.master.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

interface RotateResult {
  pair: TokenPair | null;
  reuse: { userId: string; familyId: string } | null;
}

@Injectable()
export class PlatformTokenService {
  constructor(
    @InjectRepository(PlatformRefreshToken) private tokens: Repository<PlatformRefreshToken>,
    private dataSource: DataSource,
    private jwt: JwtService,
    private audit: PlatformAuditService,
  ) {}

  /** Called after a successful OTP: starts a brand-new session (token family). */
  async issueSession(userId: string): Promise<TokenPair> {
    const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_MS);
    const { pair } = await this.issue(this.tokens.manager, userId, randomUUID(), sessionExpiresAt);
    return pair;
  }

  /** Swap a refresh token for a new pair. The presented token becomes unusable. */
  async rotate(raw: string): Promise<TokenPair> {
    const parsed = this.parse(raw);
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');

    // Never throw inside the transaction: a throw would roll back the family revocation.
    const result = await this.dataSource.transaction<RotateResult>(async (m) => {
      const repo = m.getRepository(PlatformRefreshToken);
      const row = await repo.findOne({
        where: { id: parsed.id },
        lock: { mode: 'pessimistic_write' }, // serialises concurrent refreshes of the same token
      });
      if (!row || !safeEqual(row.tokenHash, sha256(parsed.secret))) {
        return { pair: null, reuse: null };
      }

      const now = new Date();

      if (row.revokedAt) {
        // Already rotated and presented again: assume theft, kill the whole session.
        if (row.replacedById) {
          await this.revokeFamily(m, row.familyId, now);
          return { pair: null, reuse: { userId: row.userId, familyId: row.familyId } };
        }
        return { pair: null, reuse: null }; // logged out or revoked earlier
      }

      if (row.expiresAt <= now || row.sessionExpiresAt <= now) return { pair: null, reuse: null };

      const user = await m.getRepository(PlatformUser).findOne({ where: { id: row.userId } });
      if (!user || !user.isActive) {
        await this.revokeFamily(m, row.familyId, now);
        return { pair: null, reuse: null };
      }

      const next = await this.issue(m, row.userId, row.familyId, row.sessionExpiresAt);
      row.revokedAt = now;
      row.replacedById = next.id;
      await repo.save(row);
      return { pair: next.pair, reuse: null };
    });

    if (result.reuse) {
      await this.audit.record({
        actorId: result.reuse.userId,
        action: 'platform.refresh_reuse_detected',
        metadata: { familyId: result.reuse.familyId },
      });
    }
    if (!result.pair) throw new UnauthorizedException('Invalid refresh token');
    return result.pair;
  }

  /** Ends the session this refresh token belongs to. Always succeeds from the caller's view. */
  async logout(raw: string) {
    const parsed = this.parse(raw);
    if (!parsed) return;
    const row = await this.tokens.findOne({ where: { id: parsed.id } });
    if (!row || !safeEqual(row.tokenHash, sha256(parsed.secret))) return;
    await this.revokeFamily(this.tokens.manager, row.familyId);
    await this.audit.record({
      actorId: row.userId,
      action: 'platform.logout',
      metadata: { familyId: row.familyId },
    });
  }

  /** Used by the guard so logout and reuse-detection take effect immediately. */
  isSessionActive(familyId: string) {
    return this.tokens.exists({
      where: { familyId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
  }

  private async issue(m: EntityManager, userId: string, familyId: string, sessionExpiresAt: Date) {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(Date.now() + REFRESH_TTL_MS, sessionExpiresAt.getTime()));
    const repo = m.getRepository(PlatformRefreshToken);
    const row = await repo.save(
      repo.create({ familyId, userId, tokenHash: sha256(secret), expiresAt, sessionExpiresAt }),
    );
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: familyId },
      { audience: 'platform' },
    );
    const pair: TokenPair = {
      accessToken,
      refreshToken: `${row.id}.${secret}`, // id lets us find the row; only the hash of the secret is stored
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_SECONDS,
    };
    return { id: row.id, pair };
  }

  private revokeFamily(m: EntityManager, familyId: string, at = new Date()) {
    return m
      .getRepository(PlatformRefreshToken)
      .update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }

  private parse(raw: unknown): { id: string; secret: string } | null {
    if (typeof raw !== 'string') return null;
    const [id, secret, extra] = raw.split('.');
    if (!id || !secret || extra !== undefined || !UUID_RE.test(id)) return null;
    return { id, secret };
  }
}