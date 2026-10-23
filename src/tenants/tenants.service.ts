import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantConnectionService } from '../tenant-db/tenant-connection.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private repo: Repository<Tenant>,
    private conn: TenantConnectionService,
  ) {}

  findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  async create(name: string, slug: string) {
    slug = slug.toLowerCase();
    // strict regex: the name is interpolated into SQL (CREATE DATABASE can't be parameterized)
    if (!/^[a-z0-9_]{3,30}$/.test(slug)) throw new BadRequestException('Invalid slug');
    if (await this.findBySlug(slug)) throw new ConflictException('Slug taken');

    const dbName = `tenant_${slug}`;
    await this.repo.manager.query(`CREATE DATABASE "${dbName}"`);
    await this.conn.migrate(dbName);
    return this.repo.save(this.repo.create({ name, slug, dbName }));
  }
}