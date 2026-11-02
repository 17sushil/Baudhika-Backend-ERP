import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UUID_RE } from '../../../common/utils/crypto.util';
import { ALLOW_PENDING_PASSWORD_KEY, PERMISSIONS_KEY } from '../access/access.decorators';
import { UserStatus } from '../access/access.enums';
import { AccessService } from '../access/access.service';
import { User } from '../access/entities/user.tenant.entity';
import { TenantContext } from '../context/tenant-context';
import type { TenantRequest } from './auth.types';
import { TenantAccessPayload, TenantTokenService } from './services/tenant-token.service';

/**
 * Authenticates a tenant user and enforces @RequirePermissions.
 * Must run after TenantMiddleware (it reads the tenant from the request context).
 */
@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokens: TenantTokenService,
    private ctx: TenantContext,
    private access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const tenant = this.ctx.tenant;

    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: TenantAccessPayload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException();
    }
    // Token binding: a token minted for school A is worthless with x-tenant-id of school B.
    if (payload.tid !== tenant.id || !UUID_RE.test(payload.sub ?? '') || !UUID_RE.test(payload.sid ?? '')) {
      throw new UnauthorizedException();
    }

    // One query: live user + live session (logout / password change / reuse detection apply instantly).
    const user = await this.ctx
      .repo(User)
      .createQueryBuilder('u')
      .where('u.id = :id', { id: payload.sub })
      .andWhere(
        `EXISTS (SELECT 1 FROM user_sessions s WHERE s.family_id = :sid AND s.user_id = u.id
                   AND s.revoked_at IS NULL AND s.expires_at > now())`,
        { sid: payload.sid },
      )
      .getOne();
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    const targets = [context.getHandler(), context.getClass()];
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your password to continue',
      });
    }

    req.auth = { userId: user.id, sessionId: payload.sid, tenantId: tenant.id, user };

    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, targets);
    if (required?.length) {
      const permissions = await this.access.institutionPermissions(user.id);
      if (!required.every((p) => permissions.has(p))) throw new ForbiddenException('Missing permission');
      req.auth.permissions = permissions;
    }
    return true;
  }
}
