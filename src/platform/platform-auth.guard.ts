import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformUser } from './entities/platform-user.master.entity';
import { PlatformTokenService } from './services/platform-token.service';

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    @InjectRepository(PlatformUser) private users: Repository<PlatformUser>,
    private tokens: PlatformTokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync(token, {
        audience: 'platform',
      });
      if (
        typeof payload.sid !== 'string' ||
        !(await this.tokens.isSessionActive(payload.sid))
      ) {
        throw new Error('session ended');
      }
      const user = await this.users.findOne({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('inactive');
      req.platformUser = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
