import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { Page } from '../../../common/dto/pagination.dto';
import { today } from '../../../common/utils/date.util';
import { defined } from '../../../common/utils/object.util';
import { escapeLike, isCheckViolation, isUniqueViolation } from '../../../common/utils/sql.util';
import { assertCanOnCampus, campusScope } from '../access/scope.util';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { OrganizationService } from '../organization/organization.service';
import { PersonsService, toPersonView } from '../people/persons.service';
import {
  ChangeStaffStatusDto,
  CreateStaffDto,
  DriverProfileDto,
  ListStaffDto,
  QualificationDto,
  TeacherProfileDto,
  UpdateQualificationDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { DriverProfile } from './entities/driver-profile.tenant.entity';
import { StaffQualification } from './entities/staff-qualification.tenant.entity';
import { Staff } from './entities/staff.tenant.entity';
import { TeacherProfile } from './entities/teacher-profile.tenant.entity';
import { STAFF_EXIT_STATUSES, StaffKind } from './staff.enums';

const ref = <T extends { id: string; name: string }>(x: T | null | undefined) => (x ? { id: x.id, name: x.name } : null);

function toListItem(s: Staff) {
  return {
    id: s.id,
    employeeCode: s.employeeCode,
    staffType: s.staffType,
    status: s.status,
    employmentType: s.employmentType,
    joiningDate: s.joiningDate,
    campus: s.campus ? { id: s.campus.id, code: s.campus.code, name: s.campus.name } : null,
    department: ref(s.department),
    designation: ref(s.designation),
    person: { id: s.person!.id, displayName: s.person!.displayName, gender: s.person!.gender },
    createdAt: s.createdAt,
  };
}

const toTeacherView = (t: TeacherProfile | null) =>
  t && {
    highestQualification: t.highestQualification,
    specialization: t.specialization,
    experienceYears: t.experienceYears === null ? null : +t.experienceYears,
    maxWeeklyPeriods: t.maxWeeklyPeriods,
    teachingLicenseNo: t.teachingLicenseNo,
  };

const toDriverView = (d: DriverProfile | null) =>
  d && {
    licenseNo: d.licenseNo,
    licenseClass: d.licenseClass,
    licenseExpiry: d.licenseExpiry,
    medicalFitnessExpiry: d.medicalFitnessExpiry,
    policeVerificationDate: d.policeVerificationDate,
  };

const toQualificationView = (q: StaffQualification) => ({
  id: q.id,
  degree: q.degree,
  institution: q.institution,
  passedYear: q.passedYear,
  grade: q.grade,
  createdAt: q.createdAt,
});

@Injectable()
export class StaffService {
  constructor(
    private ctx: TenantContext,
    private persons: PersonsService,
    private org: OrganizationService,
    private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- staff

  async create(dto: CreateStaffDto, auth: TenantAuth) {
    assertCanOnCampus(auth, 'staff.create', dto.campusId);
    this.assertProfilesMatch(dto.staffType, dto.teacherProfile, dto.driverProfile, true);

    const id = await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        await this.assertPlacement(m, dto.campusId ?? null, dto.departmentId ?? null, dto.designationId ?? null);
        if (dto.reportsTo) await this.requireStaff(m, dto.reportsTo, 'Manager');
        const person = await this.persons.resolveRef(m, dto, auth);

        const repo = m.getRepository(Staff);
        const s = await repo.save(
          repo.create({
            personId: person.id,
            campusId: dto.campusId ?? null,
            staffType: dto.staffType,
            departmentId: dto.departmentId ?? null,
            designationId: dto.designationId ?? null,
            reportsTo: dto.reportsTo ?? null,
            employmentType: dto.employmentType ?? null,
            joiningDate: dto.joiningDate,
            probationEndDate: dto.probationEndDate ?? null,
            emergencyContactName: dto.emergencyContactName ?? null,
            emergencyContactPhone: dto.emergencyContactPhone ?? null,
            createdBy: auth.userId,
            updatedBy: auth.userId,
          }),
        );
        await this.saveProfiles(m, s.id, dto.teacherProfile, dto.driverProfile, auth);
        const after = await repo.findOneOrFail({ where: { id: s.id } });
        await this.audit.record(auth, { table: 'staff', recordId: s.id, action: AuditAction.INSERT, after }, m);
        return s.id;
      }),
    );
    return this.get(id, auth);
  }

  async list(q: ListStaffDto, auth: TenantAuth): Promise<Page<ReturnType<typeof toListItem>>> {
    const qb = this.scoped(this.ctx.repo(Staff).createQueryBuilder('s'), auth, 'staff.read')
      .innerJoinAndSelect('s.person', 'p')
      .leftJoinAndSelect('s.campus', 'c')
      .leftJoinAndSelect('s.department', 'd')
      .leftJoinAndSelect('s.designation', 'des')
      .orderBy('p.display_name', 'ASC');
    if (q.staffType) qb.andWhere('s.staff_type = :t', { t: q.staffType });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.campusId) qb.andWhere('s.campus_id = :c', { c: q.campusId });
    if (q.departmentId) qb.andWhere('s.department_id = :d', { d: q.departmentId });
    if (q.designationId) qb.andWhere('s.designation_id = :des', { des: q.designationId });
    if (q.search) {
      qb.andWhere(`(p.display_name ILIKE :s ESCAPE '\\' OR s.employee_code = :exact)`, { s: `%${escapeLike(q.search)}%`, exact: q.search });
    }
    const [rows, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return { items: rows.map(toListItem), total, page: q.page, limit: q.limit };
  }

  async get(id: string, auth: TenantAuth) {
    const s = await this.scoped(this.ctx.repo(Staff).createQueryBuilder('s'), auth, 'staff.read')
      .leftJoinAndSelect('s.campus', 'c')
      .leftJoinAndSelect('s.department', 'd')
      .leftJoinAndSelect('s.designation', 'des')
      .leftJoinAndSelect('s.manager', 'mgr')
      .leftJoinAndSelect('mgr.person', 'mp')
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!s) throw new NotFoundException('Staff not found');
    const [person, teacher, driver, qualifications, [{ n }]] = await Promise.all([
      this.persons.findFull(s.personId),
      this.ctx.repo(TeacherProfile).findOne({ where: { staffId: id } }),
      this.ctx.repo(DriverProfile).findOne({ where: { staffId: id } }),
      this.ctx.repo(StaffQualification).find({ where: { staffId: id }, order: { passedYear: 'DESC', createdAt: 'ASC' } }),
      this.ctx.dataSource.query(`SELECT count(*)::int AS n FROM staff WHERE reports_to = $1 AND deleted_at IS NULL`, [id]),
    ]);
    return {
      ...toListItem({ ...s, person: person! } as Staff),
      probationEndDate: s.probationEndDate,
      leavingDate: s.leavingDate,
      leavingReason: s.leavingReason,
      emergencyContactName: s.emergencyContactName,
      emergencyContactPhone: s.emergencyContactPhone,
      manager: s.manager ? { id: s.manager.id, employeeCode: s.manager.employeeCode, displayName: s.manager.person?.displayName ?? null } : null,
      directReports: n,
      person: toPersonView(person!, auth),
      teacherProfile: toTeacherView(teacher),
      driverProfile: toDriverView(driver),
      qualifications: qualifications.map(toQualificationView),
      updatedAt: s.updatedAt,
    };
  }

  async update(id: string, dto: UpdateStaffDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'staff.update');
    if (dto.campusId !== undefined && dto.campusId !== before.campusId) assertCanOnCampus(auth, 'staff.update', dto.campusId);
    const { teacherProfile, driverProfile, ...rest } = defined(dto);
    const merged = { ...before, ...rest };

    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        await this.assertPlacement(m, merged.campusId, merged.departmentId, merged.designationId, before);
        if (rest.reportsTo) await this.assertManager(m, id, rest.reportsTo);

        // Switching type needs the matching extension row, existing or supplied now.
        const hasTeacher = !!teacherProfile || (await m.getRepository(TeacherProfile).exists({ where: { staffId: id } }));
        const hasDriver = !!driverProfile || (await m.getRepository(DriverProfile).exists({ where: { staffId: id } }));
        this.assertProfilesMatch(merged.staffType, teacherProfile, driverProfile, false);
        if (merged.staffType === StaffKind.TEACHING && !hasTeacher) throw new BadRequestException('Teaching staff need teacherProfile');
        if (merged.staffType === StaffKind.DRIVER && !hasDriver) throw new BadRequestException('Drivers need driverProfile');

        await m.getRepository(Staff).update(id, { ...rest, updatedBy: auth.userId });
        await this.saveProfiles(m, id, teacherProfile, driverProfile, auth);
        const after = await m.getRepository(Staff).findOneOrFail({ where: { id } });
        await this.audit.record(auth, { table: 'staff', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      }),
    );
    return this.get(id, auth);
  }

  async changeStatus(id: string, dto: ChangeStaffStatusDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'staff.update');
    if (dto.status === before.status) throw new BadRequestException(`Staff is already ${dto.status}`);
    const exit = STAFF_EXIT_STATUSES.has(dto.status);
    if (exit && !dto.leavingDate) throw new BadRequestException(`leavingDate is required for ${dto.status}`);
    if (!exit && (dto.leavingDate || dto.leavingReason)) {
      throw new BadRequestException('Leaving details only apply to resigned, terminated or retired');
    }
    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        await m.getRepository(Staff).update(id, {
          status: dto.status,
          leavingDate: exit ? dto.leavingDate! : null,
          leavingReason: exit ? (dto.leavingReason ?? null) : null,
          updatedBy: auth.userId,
        });
        const after = await m.getRepository(Staff).findOneOrFail({ where: { id } });
        await this.audit.record(auth, { table: 'staff', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      }),
    );
    return this.get(id, auth);
  }

  /** For records entered by mistake; departures use a status change and keep the record. */
  async remove(id: string, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'staff.delete');
    const [{ n }] = await this.ctx.dataSource.query(
      `SELECT count(*)::int AS n FROM staff WHERE reports_to = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (n) throw new ConflictException(`${n} staff report to this person; reassign them first`);
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Staff).softDelete(id);
      await this.audit.record(auth, { table: 'staff', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- profiles

  async putTeacherProfile(id: string, dto: TeacherProfileDto, auth: TenantAuth) {
    const s = await this.findVisible(id, auth, 'staff.update');
    if (s.staffType !== StaffKind.TEACHING) throw new BadRequestException('Only teaching staff have a teacher profile');
    await this.ctx.dataSource.transaction((m) => this.saveProfiles(m, id, dto, undefined, auth));
    return this.get(id, auth);
  }

  async putDriverProfile(id: string, dto: DriverProfileDto, auth: TenantAuth) {
    const s = await this.findVisible(id, auth, 'staff.update');
    if (s.staffType !== StaffKind.DRIVER) throw new BadRequestException('Only drivers have a driver profile');
    await this.ctx.dataSource.transaction((m) => this.saveProfiles(m, id, undefined, dto, auth));
    return this.get(id, auth);
  }

  // ---------------------------------------------------------------- qualifications

  async addQualification(id: string, dto: QualificationDto, auth: TenantAuth) {
    await this.findVisible(id, auth, 'staff.update');
    this.assertPassedYear(dto.passedYear);
    const q = await this.ctx.dataSource.transaction(async (m) => {
      const row = await m.getRepository(StaffQualification).save({ ...defined(dto), staffId: id });
      await this.audit.record(auth, { table: 'staff_qualifications', recordId: row.id, action: AuditAction.INSERT, after: row }, m);
      return row;
    });
    return toQualificationView(q);
  }

  async updateQualification(id: string, qualificationId: string, dto: UpdateQualificationDto, auth: TenantAuth) {
    await this.findVisible(id, auth, 'staff.update');
    this.assertPassedYear(dto.passedYear);
    const before = await this.ctx.repo(StaffQualification).findOne({ where: { id: qualificationId, staffId: id } });
    if (!before) throw new NotFoundException('Qualification not found');
    const q = await this.ctx.dataSource.transaction(async (m) => {
      const after = await m.getRepository(StaffQualification).save({ ...before, ...defined(dto) });
      await this.audit.record(auth, { table: 'staff_qualifications', recordId: qualificationId, action: AuditAction.UPDATE, before, after }, m);
      return after;
    });
    return toQualificationView(q);
  }

  async removeQualification(id: string, qualificationId: string, auth: TenantAuth) {
    await this.findVisible(id, auth, 'staff.update');
    const before = await this.ctx.repo(StaffQualification).findOne({ where: { id: qualificationId, staffId: id } });
    if (!before) throw new NotFoundException('Qualification not found');
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(StaffQualification).softDelete(qualificationId);
      await this.audit.record(auth, { table: 'staff_qualifications', recordId: qualificationId, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- helpers

  private async saveProfiles(m: EntityManager, staffId: string, teacher: TeacherProfileDto | undefined, driver: DriverProfileDto | undefined, auth: TenantAuth) {
    if (teacher) {
      const repo = m.getRepository(TeacherProfile);
      const before = await repo.findOne({ where: { staffId } });
      const after = await repo.save({
        ...before,
        staffId,
        ...defined(teacher),
        experienceYears:
          teacher.experienceYears === undefined
            ? (before?.experienceYears ?? null)
            : teacher.experienceYears === null
              ? null
              : String(teacher.experienceYears),
      });
      await this.audit.record(auth, { table: 'teacher_profiles', recordId: staffId, action: before ? AuditAction.UPDATE : AuditAction.INSERT, before, after }, m);
    }
    if (driver) {
      if (driver.licenseExpiry < today()) throw new BadRequestException('Driving licence is expired');
      const repo = m.getRepository(DriverProfile);
      const before = await repo.findOne({ where: { staffId } });
      const after = await repo.save({ ...before, staffId, ...defined(driver) });
      await this.audit.record(auth, { table: 'driver_profiles', recordId: staffId, action: before ? AuditAction.UPDATE : AuditAction.INSERT, before, after }, m);
    }
  }

  /** Profiles must match the staff type; on create the matching one is mandatory. */
  private assertProfilesMatch(type: StaffKind, teacher: unknown, driver: unknown, requireMatching: boolean) {
    if (teacher && type !== StaffKind.TEACHING) throw new BadRequestException('teacherProfile only applies to teaching staff');
    if (driver && type !== StaffKind.DRIVER) throw new BadRequestException('driverProfile only applies to drivers');
    if (requireMatching && type === StaffKind.TEACHING && !teacher) throw new BadRequestException('Teaching staff need teacherProfile');
    if (requireMatching && type === StaffKind.DRIVER && !driver) throw new BadRequestException('Drivers need driverProfile');
  }

  /** Campus/department/designation must be live and active, and the department must sit on the staff's campus. */
  private async assertPlacement(m: EntityManager, campusId: string | null, departmentId: string | null, designationId: string | null, before?: Staff) {
    if (campusId && campusId !== before?.campusId) await this.org.requireActiveCampus(campusId, m);
    if (designationId && designationId !== before?.designationId) await this.org.requireActiveDesignation(designationId, m);
    if (departmentId) {
      const d = departmentId !== before?.departmentId ? await this.org.requireActiveDepartment(departmentId, m) : null;
      const deptCampus = d ? d.campusId : (await m.query(`SELECT campus_id FROM departments WHERE id = $1`, [departmentId]))[0]?.campus_id;
      if (deptCampus && deptCampus !== campusId) throw new BadRequestException('Department belongs to a different campus');
    }
  }

  private async requireStaff(m: EntityManager, id: string, label: string) {
    const s = await m.getRepository(Staff).findOne({ where: { id } });
    if (!s) throw new BadRequestException(`${label} not found`);
    return s;
  }

  /** Manager must exist, not be the employee, and not be someone who (indirectly) reports to them. */
  private async assertManager(m: EntityManager, staffId: string, managerId: string) {
    if (managerId === staffId) throw new BadRequestException('Staff cannot report to themselves');
    await this.requireStaff(m, managerId, 'Manager');
    const [{ cycle }] = await m.query(
      `WITH RECURSIVE chain(id, reports_to, depth) AS (
         SELECT id, reports_to, 1 FROM staff WHERE id = $1
         UNION ALL
         SELECT s.id, s.reports_to, c.depth + 1 FROM staff s JOIN chain c ON s.id = c.reports_to WHERE c.depth < 100
       )
       SELECT EXISTS (SELECT 1 FROM chain WHERE id = $2) AS cycle`,
      [managerId, staffId],
    );
    if (cycle) throw new BadRequestException('That manager reports (directly or indirectly) to this employee');
  }

  private assertPassedYear(year: number | null | undefined) {
    if (year && year > +today().slice(0, 4) + 1) throw new BadRequestException('passedYear is in the future');
  }

  private async findVisible(id: string, auth: TenantAuth, perm: string): Promise<Staff> {
    const s = await this.scoped(this.ctx.repo(Staff).createQueryBuilder('s'), auth, perm).andWhere('s.id = :id', { id }).getOne();
    if (!s) throw new NotFoundException('Staff not found');
    return s;
  }

  private scoped(qb: SelectQueryBuilder<Staff>, auth: TenantAuth, perm: string) {
    const campusIds = campusScope(auth, perm);
    if (campusIds) qb.andWhere('s.campus_id = ANY(CAST(:campusIds AS uuid[]))', { campusIds });
    return qb;
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isUniqueViolation(e, 'uq_staff_person_live')) throw new ConflictException('This person already has a staff profile');
      if (isCheckViolation(e)) throw new BadRequestException('Dates are inconsistent (e.g. leaving or probation end before joining date)');
      throw e;
    }
  }
}
