import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { encryptSecret } from '../../../../common/utils/crypto.util';
import { hashPassword } from '../../../../common/utils/password.util';
import { masterOptions } from '../../../../database/master/master-options';
import { TenantDbTarget } from '../../../../database/tenant/tenant-options';
import { ScopeKind } from '../../../tenant/access/access.enums';
import { Role } from '../../../tenant/access/entities/role.tenant.entity';
import { UserRole } from '../../../tenant/access/entities/user-role.tenant.entity';
import { User } from '../../../tenant/access/entities/user.tenant.entity';
import { TenantConnectionService } from '../../../tenant/context/tenant-connection.service';
import { PlatformAuditService } from '../../platform-auth/services/platform-audit.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant, TenantStatus } from '../entities/tenant.master.entity';
import { isValidSlug } from '../utils/host.util';
import { scramSha256Verifier } from '../utils/pg-scram.util';
import { TenantsService, toTenantView } from './tenants.service';

// Identifiers are interpolated into DDL (CREATE DATABASE/ROLE can't be parameterised): keep them strict.
const DB_IDENT_RE = /^tenant_[a-z0-9_]{3,30}$/;

/**
 * Creates a tenant: claims the slug, creates a dedicated Postgres role + database, runs tenant
 * migrations, creates the first school admin, then marks the tenant active.
 * On failure the tenant is marked FAILED and the same request can simply be retried.
 */
@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    @InjectRepository(Tenant) private repo: Repository<Tenant>,
    @InjectDataSource() private master: DataSource,
    private tenants: TenantsService,
    private connections: TenantConnectionService,
    private audit: PlatformAuditService,
  ) {}

  async create(dto: CreateTenantDto, actorId: string) {
    const slug = dto.slug.toLowerCase();
    if (!isValidSlug(slug)) throw new BadRequestException('Invalid or reserved slug');

    const dbName = `tenant_${slug.replace(/-/g, '_')}`;
    if (!DB_IDENT_RE.test(dbName)) throw new BadRequestException('Invalid slug');
    const dbPassword = randomBytes(24).toString('base64url');

    const { tenant, retry } = await this.claim(slug, dto.name, dbName, encryptSecret(dbPassword));

    try {
      if (retry) await this.connections.evict(tenant.id);
      await this.createDatabase(dbName, dbPassword, retry);

      const target: TenantDbTarget = { database: dbName, username: dbName, password: dbPassword };
      await this.connections.withDataSource(target, async (ds) => {
        await ds.runMigrations({ transaction: 'each' });
        await this.createFirstAdmin(ds, dto.adminEmail, dto.adminPassword);
      });

      await this.repo.update(tenant.id, { status: TenantStatus.ACTIVE, provisioningError: null });
    } catch (e) {
      const message = (e as Error).message ?? String(e);
      this.logger.error(`Provisioning ${slug} failed: ${message}`, (e as Error).stack);
      await this.repo.update(tenant.id, { status: TenantStatus.FAILED, provisioningError: message.slice(0, 2000) });
      this.tenants.invalidate(tenant);
      await this.audit.record({ actorId, action: 'tenant.provision_failed', targetType: 'tenant', targetId: tenant.id });
      throw new InternalServerErrorException('Provisioning failed. Retry with the same slug.');
    }

    this.tenants.invalidate(tenant);
    await this.audit.record({
      actorId,
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: { slug, retry },
    });
    return toTenantView(await this.repo.findOneByOrFail({ id: tenant.id }));
  }

  /** Atomically reserve the slug. A FAILED tenant can be re-claimed; anything else is taken. */
  private async claim(slug: string, name: string, dbName: string, dbPasswordEnc: string) {
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) {
      if (existing.status !== TenantStatus.FAILED) throw new ConflictException('Slug taken');
      const res = await this.repo.update(
        { id: existing.id, status: TenantStatus.FAILED },
        { status: TenantStatus.PROVISIONING, name, dbUser: dbName, dbPasswordEnc, provisioningError: null },
      );
      if (res.affected !== 1) throw new ConflictException('Provisioning already in progress');
      return { tenant: existing, retry: true };
    }

    try {
      const tenant = await this.repo.save(
        this.repo.create({ slug, name, dbName, dbUser: dbName, dbPasswordEnc, status: TenantStatus.PROVISIONING }),
      );
      return { tenant, retry: false };
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).code === '23505') throw new ConflictException('Slug taken');
      throw e;
    }
  }

  private async createDatabase(dbName: string, dbPassword: string, retry: boolean) {
    if (!DB_IDENT_RE.test(dbName)) throw new Error('Unsafe database identifier');
    const limit = Math.trunc(+(process.env.TENANT_DB_CONNECTION_LIMIT ?? 30));

    await this.withProvisioner(async (q) => {
      // Only ever reached for a slug whose tenant row is FAILED, i.e. never went live.
      if (retry) await q(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);

      await q(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${dbName}') THEN CREATE ROLE "${dbName}"; END IF;
      END $$`);
      // Least privilege: the tenant role can only own and use its own database.
      await q(
        `ALTER ROLE "${dbName}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS ` +
          `CONNECTION LIMIT ${limit} PASSWORD '${scramSha256Verifier(dbPassword)}'`,
      );
      // A non-superuser provisioner (CREATEROLE) must be a member to create a database owned by the role.
      const [{ rolsuper }] = await q(`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`);
      if (!rolsuper) await q(`GRANT "${dbName}" TO CURRENT_USER`);

      await q(`CREATE DATABASE "${dbName}" OWNER "${dbName}"`);
      // No other tenant role may even connect to this database.
      await q(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC`);
    });
  }

  /** DDL runs with PROVISIONER_DB_* if set (CREATEDB + CREATEROLE), else the master connection. */
  private async withProvisioner(fn: (q: (sql: string) => Promise<any[]>) => Promise<void>) {
    if (!process.env.PROVISIONER_DB_USER) {
      return fn((sql) => this.master.query(sql));
    }
    const ds = new DataSource({
      ...masterOptions(),
      username: process.env.PROVISIONER_DB_USER,
      password: process.env.PROVISIONER_DB_PASS,
      entities: [],
      migrations: [],
      extra: { max: 1 },
    } as typeof this.master.options);
    await ds.initialize();
    try {
      await fn((sql) => ds.query(sql));
    } finally {
      await ds.destroy();
    }
  }

  private async createFirstAdmin(ds: DataSource, email: string, password: string) {
    const passwordHash = await hashPassword(password);
    await ds.transaction(async (m) => {
      const users = m.getRepository(User);
      const user = await users.save(
        users.create({ email: email.toLowerCase(), passwordHash, mustChangePassword: true }),
      );
      const admin = await m.getRepository(Role).findOneByOrFail({ code: 'admin' });
      await m.getRepository(UserRole).insert({ userId: user.id, roleId: admin.id, scopeType: ScopeKind.INSTITUTION });
    });
  }
}
