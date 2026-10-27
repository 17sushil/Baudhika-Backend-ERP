import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.master.entity';
import { TenantConnectionService } from '../../tenant-db/tenant-connection.service';
import { PlatformAuditService } from '../../platform/services/platform-audit.service';
import { isValidSlug } from '../utils/host.util';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private repo: Repository<Tenant>,
    private conn: TenantConnectionService,
    private audit: PlatformAuditService,
  ) {}

  findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  list() {
    return this.repo.find({
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        customDomain: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async create(name: string, slug: string, actorId: string) {
    slug = slug.toLowerCase();
    // strict regex: the name is interpolated into SQL (CREATE DATABASE can't be parameterized)
    // if (!/^[a-z0-9_]{3,30}$/.test(slug))
    //   throw new BadRequestException('Invalid slug');

    if (!isValidSlug(slug))
      throw new BadRequestException('Invalid or reserved slug');

    if (await this.findBySlug(slug)) throw new ConflictException('Slug taken');

    // const dbName = `tenant_${slug}`;
    const dbName = `tenant_${slug.replace(/-/g, '_')}`;
    await this.repo.manager.query(`CREATE DATABASE "${dbName}"`);
    await this.conn.migrate(dbName);
    const tenant = await this.repo.save(
      this.repo.create({ name, slug, dbName, status: TenantStatus.ACTIVE }),
    );
    await this.audit.record({
      actorId,
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug },
    });
    return tenant;
  }
}
