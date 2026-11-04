import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { Page } from '../../../common/dto/pagination.dto';
import { defined } from '../../../common/utils/object.util';
import { escapeLike, isUniqueViolation } from '../../../common/utils/sql.util';
import { normalizePhone } from '../access/identifier.util';
import { campusScope, hasPermission } from '../access/scope.util';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { PersonsService, toPersonView } from '../people/persons.service';
import { CreateGuardianDto, GuardianFieldsDto, ListGuardiansDto, UpdateGuardianDto } from './dto/guardian.dto';
import { Guardian } from './entities/guardian.tenant.entity';

/** Guardian linked to a live student on :campusIds, or not linked to any live student yet. */
export function guardianInCampusesSql(alias: string) {
  return `(
    EXISTS (SELECT 1 FROM student_guardians sg JOIN students s ON s.id = sg.student_id
            WHERE sg.guardian_id = ${alias}.id AND s.deleted_at IS NULL AND s.campus_id = ANY(CAST(:campusIds AS uuid[])))
    OR NOT EXISTS (SELECT 1 FROM student_guardians sg2 JOIN students s2 ON s2.id = sg2.student_id
                   WHERE sg2.guardian_id = ${alias}.id AND s2.deleted_at IS NULL)
  )`;
}

const PRIMARY_PHONE_SQL = (personAlias: string) =>
  `(SELECT c.value FROM person_contacts c WHERE c.person_id = ${personAlias}.id AND c.deleted_at IS NULL
      AND c.type IN ('phone', 'whatsapp') ORDER BY c.is_primary DESC, c.created_at ASC LIMIT 1)`;

@Injectable()
export class GuardiansService {
  constructor(
    private ctx: TenantContext,
    private persons: PersonsService,
    private audit: AuditService,
  ) {}

  /** Creates a guardian profile (and the person when inline). Used by student guardian linking too. */
  async createInTx(m: EntityManager, dto: CreateGuardianDto, auth: TenantAuth): Promise<Guardian> {
    this.assertIncomeWrite(dto, auth);
    const person = await this.persons.resolveRef(m, dto, auth);
    const repo = m.getRepository(Guardian);
    try {
      const g = await repo.save(
        repo.create({
          personId: person.id,
          qualification: dto.qualification ?? null,
          occupation: dto.occupation ?? null,
          employer: dto.employer ?? null,
          annualIncome: dto.annualIncome == null ? null : String(dto.annualIncome),
          createdBy: auth.userId,
          updatedBy: auth.userId,
        }),
      );
      await this.audit.record(auth, { table: 'guardians', recordId: g.id, action: AuditAction.INSERT, after: g }, m);
      return g;
    } catch (e) {
      if (isUniqueViolation(e, 'uq_guardians_person_live')) throw new ConflictException('This person already has a guardian profile');
      throw e;
    }
  }

  async create(dto: CreateGuardianDto, auth: TenantAuth) {
    const g = await this.ctx.dataSource.transaction((m) => this.createInTx(m, dto, auth));
    return this.get(g.id, auth);
  }

  async list(q: ListGuardiansDto, auth: TenantAuth): Promise<Page<unknown>> {
    const qb = this.scoped(this.ctx.repo(Guardian).createQueryBuilder('g'), auth, 'guardian.read')
      .innerJoin('g.person', 'p')
      .addSelect(['p.id', 'p.displayName'])
      .addSelect(PRIMARY_PHONE_SQL('p'), 'primary_phone')
      .orderBy('p.display_name', 'ASC');
    if (q.search) {
      const contact = q.search.includes('@') ? q.search.toLowerCase() : normalizePhone(q.search);
      qb.andWhere(
        `(p.display_name ILIKE :s ESCAPE '\\' OR EXISTS (SELECT 1 FROM person_contacts c WHERE c.person_id = p.id AND c.deleted_at IS NULL AND c.value = :contact))`,
        { s: `%${escapeLike(q.search)}%`, contact },
      );
    }
    const total = await qb.getCount();
    const { entities, raw } = await qb
      .offset((q.page - 1) * q.limit)
      .limit(q.limit)
      .getRawAndEntities();
    const items = entities.map((g, i) => ({
      ...this.view(g, auth),
      person: { id: g.person!.id, displayName: g.person!.displayName, primaryPhone: raw[i]?.primary_phone ?? null },
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  async get(id: string, auth: TenantAuth) {
    const g = await this.findVisible(id, auth, 'guardian.read');
    const person = (await this.persons.findFull(g.personId))!;
    const campusIds = campusScope(auth, 'guardian.read');
    const children = await this.ctx.dataSource.query(
      `SELECT s.id AS "studentId", s.admission_no AS "admissionNo", p.display_name AS "displayName", s.status,
              sg.relation, sg.is_primary AS "isPrimary"
         FROM student_guardians sg
         JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL
         JOIN persons p ON p.id = s.person_id
        WHERE sg.guardian_id = $1 AND ($2::uuid[] IS NULL OR s.campus_id = ANY($2::uuid[]))
        ORDER BY p.display_name`,
      [id, campusIds],
    );
    return { ...this.view(g, auth), person: toPersonView(person, auth), children };
  }

  async update(id: string, dto: UpdateGuardianDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'guardian.update');
    this.assertIncomeWrite(dto, auth);
    const changes = defined(dto);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Guardian).update(id, {
        ...changes,
        annualIncome: changes.annualIncome === undefined ? undefined : changes.annualIncome === null ? null : String(changes.annualIncome),
        updatedBy: auth.userId,
      });
      const after = await m.getRepository(Guardian).findOneOrFail({ where: { id } });
      await this.audit.record(auth, { table: 'guardians', recordId: id, action: AuditAction.UPDATE, before, after }, m);
    });
    return this.get(id, auth);
  }

  async remove(id: string, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'guardian.delete');
    const [{ n }] = await this.ctx.dataSource.query(
      `SELECT count(*)::int AS n FROM student_guardians sg JOIN students s ON s.id = sg.student_id
        WHERE sg.guardian_id = $1 AND s.deleted_at IS NULL`,
      [id],
    );
    if (n) throw new ConflictException(`Guardian is linked to ${n} student(s). Unlink them first.`);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Guardian).softDelete(id);
      await this.audit.record(auth, { table: 'guardians', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- helpers

  /** annual_income only for holders of guardian.sensitive.read. */
  view(g: Guardian, auth: TenantAuth) {
    const sensitive = hasPermission(auth, 'guardian.sensitive.read');
    return {
      id: g.id,
      personId: g.personId,
      qualification: g.qualification,
      occupation: g.occupation,
      employer: g.employer,
      ...(sensitive ? { annualIncome: g.annualIncome === null ? null : +g.annualIncome } : {}),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  private async findVisible(id: string, auth: TenantAuth, perm: string): Promise<Guardian> {
    const g = await this.scoped(this.ctx.repo(Guardian).createQueryBuilder('g'), auth, perm).andWhere('g.id = :id', { id }).getOne();
    if (!g) throw new NotFoundException('Guardian not found');
    return g;
  }

  private scoped(qb: SelectQueryBuilder<Guardian>, auth: TenantAuth, perm: string) {
    const campusIds = campusScope(auth, perm);
    if (campusIds) qb.andWhere(guardianInCampusesSql('g'), { campusIds });
    return qb;
  }

  private assertIncomeWrite(dto: Pick<GuardianFieldsDto, 'annualIncome'>, auth: TenantAuth) {
    if (dto.annualIncome !== undefined && !hasPermission(auth, 'guardian.sensitive.read')) {
      throw new ForbiddenException('Annual income needs guardian.sensitive.read');
    }
  }
}
