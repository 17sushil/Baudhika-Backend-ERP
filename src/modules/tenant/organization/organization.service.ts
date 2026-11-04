import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { today } from '../../../common/utils/date.util';
import { defined } from '../../../common/utils/object.util';
import { isUniqueViolation } from '../../../common/utils/sql.util';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { CreateCampusDto, ListCampusesDto, UpdateCampusDto } from './dto/campus.dto';
import {
  CreateDepartmentDto,
  CreateDesignationDto,
  ListDepartmentsDto,
  ListDesignationsDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
} from './dto/department.dto';
import { UpdateNumberSequenceDto } from './dto/number-sequence.dto';
import { Campus } from './entities/campus.tenant.entity';
import { Department } from './entities/department.tenant.entity';
import { Designation } from './entities/designation.tenant.entity';
import { NumberSequence } from './entities/number-sequence.tenant.entity';

export const toCampusView = (c: Campus) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  kind: c.kind,
  emisSchoolCode: c.emisSchoolCode,
  address: c.address,
  phone: c.phone,
  isActive: c.isActive,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const toDepartmentView = (d: Department) => ({
  id: d.id,
  campusId: d.campusId,
  code: d.code,
  name: d.name,
  isActive: d.isActive,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const toDesignationView = (d: Designation) => ({
  id: d.id,
  name: d.name,
  isActive: d.isActive,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

function toSequenceView(s: NumberSequence) {
  const year = +today().slice(0, 4);
  const next = s.resetYearly && s.lastResetYear !== year ? 1 : +s.nextValue;
  const digits = String(next).length >= s.padding ? String(next) : String(next).padStart(s.padding, '0');
  return {
    code: s.code,
    prefix: s.prefix,
    padding: s.padding,
    nextValue: +s.nextValue,
    resetYearly: s.resetYearly,
    lastResetYear: s.lastResetYear,
    preview: `${s.prefix}${s.resetYearly ? `${year}-` : ''}${digits}`,
  };
}

/** Campuses, departments, designations and number series: the shared building blocks. */
@Injectable()
export class OrganizationService {
  constructor(
    private ctx: TenantContext,
    private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- lookups used by other modules

  /** A live, active campus or 400. */
  async requireActiveCampus(id: string, m: EntityManager = this.ctx.dataSource.manager): Promise<Campus> {
    const c = await m.getRepository(Campus).findOne({ where: { id } });
    if (!c) throw new BadRequestException('Campus not found');
    if (!c.isActive) throw new BadRequestException('Campus is inactive');
    return c;
  }

  async requireActiveDepartment(id: string, m: EntityManager = this.ctx.dataSource.manager): Promise<Department> {
    const d = await m.getRepository(Department).findOne({ where: { id } });
    if (!d) throw new BadRequestException('Department not found');
    if (!d.isActive) throw new BadRequestException('Department is inactive');
    return d;
  }

  async requireActiveDesignation(id: string, m: EntityManager = this.ctx.dataSource.manager): Promise<Designation> {
    const d = await m.getRepository(Designation).findOne({ where: { id } });
    if (!d) throw new BadRequestException('Designation not found');
    if (!d.isActive) throw new BadRequestException('Designation is inactive');
    return d;
  }

  // ---------------------------------------------------------------- campuses

  async listCampuses(q: ListCampusesDto) {
    const qb = this.ctx.repo(Campus).createQueryBuilder('c').orderBy('c.name', 'ASC');
    if (q.isActive !== undefined) qb.andWhere('c.is_active = :a', { a: q.isActive });
    if (q.kind) qb.andWhere('c.kind = :k', { k: q.kind });
    return (await qb.getMany()).map(toCampusView);
  }

  async getCampus(id: string) {
    return toCampusView(await this.findCampus(id));
  }

  async createCampus(dto: CreateCampusDto, actor: TenantAuth) {
    const saved = await this.unique('Campus code already exists', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(Campus);
        const c = await repo.save(repo.create(defined(dto)));
        await this.audit.record(actor, { table: 'campuses', recordId: c.id, action: AuditAction.INSERT, after: c }, m);
        return c;
      }),
    );
    return toCampusView(saved);
  }

  async updateCampus(id: string, dto: UpdateCampusDto, actor: TenantAuth) {
    const before = await this.findCampus(id);
    const saved = await this.unique('Campus code already exists', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const c = await m.getRepository(Campus).save({ ...before, ...defined(dto) });
        await this.audit.record(actor, { table: 'campuses', recordId: id, action: AuditAction.UPDATE, before, after: c }, m);
        return c;
      }),
    );
    return toCampusView(saved);
  }

  async deleteCampus(id: string, actor: TenantAuth) {
    const before = await this.findCampus(id);
    const [usage] = await this.ctx.dataSource.query(
      `SELECT (SELECT count(*) FROM students WHERE campus_id = $1 AND deleted_at IS NULL)::int AS students,
              (SELECT count(*) FROM staff WHERE campus_id = $1 AND deleted_at IS NULL)::int AS staff,
              (SELECT count(*) FROM departments WHERE campus_id = $1 AND deleted_at IS NULL)::int AS departments`,
      [id],
    );
    if (usage.students || usage.staff || usage.departments) {
      throw new ConflictException(
        `Campus is in use (${usage.students} students, ${usage.staff} staff, ${usage.departments} departments). Deactivate it instead.`,
      );
    }
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Campus).softDelete(id);
      await this.audit.record(actor, { table: 'campuses', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- departments

  async listDepartments(q: ListDepartmentsDto) {
    const qb = this.ctx.repo(Department).createQueryBuilder('d').orderBy('d.name', 'ASC');
    if (q.campusId) qb.andWhere('d.campus_id = :c', { c: q.campusId });
    if (q.isActive !== undefined) qb.andWhere('d.is_active = :a', { a: q.isActive });
    return (await qb.getMany()).map(toDepartmentView);
  }

  async getDepartment(id: string) {
    return toDepartmentView(await this.findDepartment(id));
  }

  async createDepartment(dto: CreateDepartmentDto, actor: TenantAuth) {
    if (dto.campusId) await this.findCampus(dto.campusId, BadRequestException);
    const saved = await this.unique('A department with this name already exists on this campus', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(Department);
        const d = await repo.save(repo.create({ ...defined(dto), campusId: dto.campusId ?? null }));
        await this.audit.record(actor, { table: 'departments', recordId: d.id, action: AuditAction.INSERT, after: d }, m);
        return d;
      }),
    );
    return toDepartmentView(saved);
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, actor: TenantAuth) {
    const before = await this.findDepartment(id);
    if (dto.campusId) await this.findCampus(dto.campusId, BadRequestException);
    if (dto.campusId !== undefined && dto.campusId !== before.campusId) {
      // Moving a department must not leave its staff on a different campus.
      const [{ n }] = await this.ctx.dataSource.query(
        `SELECT count(*)::int AS n FROM staff WHERE department_id = $1 AND deleted_at IS NULL
           AND campus_id IS DISTINCT FROM $2 AND $2::uuid IS NOT NULL`,
        [id, dto.campusId],
      );
      if (n) throw new ConflictException(`${n} staff of this department work on another campus`);
    }
    const saved = await this.unique('A department with this name already exists on this campus', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const d = await m.getRepository(Department).save({ ...before, ...defined(dto) });
        await this.audit.record(actor, { table: 'departments', recordId: id, action: AuditAction.UPDATE, before, after: d }, m);
        return d;
      }),
    );
    return toDepartmentView(saved);
  }

  async deleteDepartment(id: string, actor: TenantAuth) {
    const before = await this.findDepartment(id);
    const [{ n }] = await this.ctx.dataSource.query(
      `SELECT count(*)::int AS n FROM staff WHERE department_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (n) throw new ConflictException(`Department has ${n} staff. Move them or deactivate it instead.`);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Department).softDelete(id);
      await this.audit.record(actor, { table: 'departments', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- designations

  async listDesignations(q: ListDesignationsDto) {
    const qb = this.ctx.repo(Designation).createQueryBuilder('d').orderBy('d.name', 'ASC');
    if (q.isActive !== undefined) qb.andWhere('d.is_active = :a', { a: q.isActive });
    return (await qb.getMany()).map(toDesignationView);
  }

  async getDesignation(id: string) {
    return toDesignationView(await this.findDesignation(id));
  }

  async createDesignation(dto: CreateDesignationDto, actor: TenantAuth) {
    const saved = await this.unique('Designation already exists', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const repo = m.getRepository(Designation);
        const d = await repo.save(repo.create(defined(dto)));
        await this.audit.record(actor, { table: 'designations', recordId: d.id, action: AuditAction.INSERT, after: d }, m);
        return d;
      }),
    );
    return toDesignationView(saved);
  }

  async updateDesignation(id: string, dto: UpdateDesignationDto, actor: TenantAuth) {
    const before = await this.findDesignation(id);
    const saved = await this.unique('Designation already exists', () =>
      this.ctx.dataSource.transaction(async (m) => {
        const d = await m.getRepository(Designation).save({ ...before, ...defined(dto) });
        await this.audit.record(actor, { table: 'designations', recordId: id, action: AuditAction.UPDATE, before, after: d }, m);
        return d;
      }),
    );
    return toDesignationView(saved);
  }

  async deleteDesignation(id: string, actor: TenantAuth) {
    const before = await this.findDesignation(id);
    const [{ n }] = await this.ctx.dataSource.query(
      `SELECT count(*)::int AS n FROM staff WHERE designation_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (n) throw new ConflictException(`Designation is used by ${n} staff. Deactivate it instead.`);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Designation).softDelete(id);
      await this.audit.record(actor, { table: 'designations', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- number sequences

  async listSequences() {
    return (await this.ctx.repo(NumberSequence).find({ order: { code: 'ASC' } })).map(toSequenceView);
  }

  async updateSequence(code: string, dto: UpdateNumberSequenceDto, actor: TenantAuth) {
    return this.ctx.dataSource.transaction(async (m) => {
      const repo = m.getRepository(NumberSequence);
      // Lock like next_code() does, so a concurrent admission can't interleave with the change.
      const before = await repo.findOne({ where: { code }, lock: { mode: 'pessimistic_write' } });
      if (!before) throw new NotFoundException('Number sequence not found');
      const s = await repo.save({ ...before, ...defined(dto) });
      await this.audit.record(
        actor,
        // number_sequences has a text key; audit_logs.record_id is uuid, so log under a stable per-code uuid.
        { table: 'number_sequences', recordId: await this.codeUuid(m, code), action: AuditAction.UPDATE, before, after: s },
        m,
      );
      return toSequenceView(s);
    });
  }

  // ---------------------------------------------------------------- helpers

  private async findCampus(id: string, Err: new (msg: string) => Error = NotFoundException) {
    const c = await this.ctx.repo(Campus).findOne({ where: { id } });
    if (!c) throw new Err('Campus not found');
    return c;
  }

  private async findDepartment(id: string) {
    const d = await this.ctx.repo(Department).findOne({ where: { id } });
    if (!d) throw new NotFoundException('Department not found');
    return d;
  }

  private async findDesignation(id: string) {
    const d = await this.ctx.repo(Designation).findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designation not found');
    return d;
  }

  private async codeUuid(m: EntityManager, code: string): Promise<string> {
    const [{ id }] = await m.query(`SELECT md5('number_sequences:' || $1)::uuid AS id`, [code]);
    return id;
  }

  private async unique<T>(message: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(message);
      throw e;
    }
  }
}
