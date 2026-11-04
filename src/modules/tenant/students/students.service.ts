import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { Page } from '../../../common/dto/pagination.dto';
import { today } from '../../../common/utils/date.util';
import { defined } from '../../../common/utils/object.util';
import { escapeLike, isCheckViolation, isUniqueViolation } from '../../../common/utils/sql.util';
import { assertCanOnCampus, assertPermission, campusScope } from '../access/scope.util';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import { Guardian } from '../guardians/entities/guardian.tenant.entity';
import { GuardiansService } from '../guardians/guardians.service';
import { OrganizationService } from '../organization/organization.service';
import { PersonsService, toPersonView } from '../people/persons.service';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  LinkGuardianDto,
  ListStudentsDto,
  StudentHealthDto,
  UpdateGuardianLinkDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { StudentGuardian } from './entities/student-guardian.tenant.entity';
import { StudentHealth } from './entities/student-health.tenant.entity';
import { StudentStatusHistory } from './entities/student-status-history.tenant.entity';
import { Student } from './entities/student.tenant.entity';
import { AdmissionKind, EXIT_STATUSES, StudentStatus } from './students.enums';

const HEALTH_FIELDS = [
  'allergies',
  'medicalConditions',
  'medications',
  'disabilityType',
  'disabilityNotes',
  'doctorName',
  'doctorPhone',
  'insuranceNo',
  'emergencyInstructions',
] as const;

/** A link counts only inside its validity window. */
const LINK_ACTIVE_SQL = `(sg.valid_from IS NULL OR sg.valid_from <= $2::date) AND (sg.valid_to IS NULL OR sg.valid_to >= $2::date)`;

function toListItem(s: Student) {
  return {
    id: s.id,
    admissionNo: s.admissionNo,
    emisId: s.emisId,
    status: s.status,
    admissionType: s.admissionType,
    admissionDate: s.admissionDate,
    hasSpecialNeeds: s.hasSpecialNeeds,
    campus: s.campus ? { id: s.campus.id, code: s.campus.code, name: s.campus.name } : null,
    person: { id: s.person!.id, displayName: s.person!.displayName, gender: s.person!.gender, dob: s.person!.dob },
    createdAt: s.createdAt,
  };
}

function toHealthView(studentId: string, h: StudentHealth | null) {
  const base = Object.fromEntries(HEALTH_FIELDS.map((k) => [k, h ? h[k] : null]));
  return { studentId, ...base, updatedAt: h?.updatedAt ?? null, updatedBy: h?.updatedBy ?? null };
}

@Injectable()
export class StudentsService {
  constructor(
    private ctx: TenantContext,
    private persons: PersonsService,
    private guardians: GuardiansService,
    private org: OrganizationService,
    private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- students

  async create(dto: CreateStudentDto, auth: TenantAuth) {
    assertCanOnCampus(auth, 'student.create', dto.campusId);
    this.assertTransferDetails(dto);

    const id = await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        if (dto.campusId) await this.org.requireActiveCampus(dto.campusId, m);
        const person = await this.persons.resolveRef(m, dto, auth);
        this.persons.assertStudentReady(person);

        const repo = m.getRepository(Student);
        const s = await repo.save(
          repo.create({
            personId: person.id,
            campusId: dto.campusId ?? null,
            admissionDate: dto.admissionDate,
            admissionType: dto.admissionType ?? AdmissionKind.NEW,
            emisId: dto.emisId ?? null,
            previousSchoolName: dto.previousSchoolName ?? null,
            previousSchoolClass: dto.previousSchoolClass ?? null,
            previousTcNo: dto.previousTcNo ?? null,
            hasSpecialNeeds: dto.hasSpecialNeeds ?? false,
            remarks: dto.remarks ?? null,
            // Activation needs a primary guardian, so every admission starts as an applicant.
            status: StudentStatus.APPLICANT,
            createdBy: auth.userId,
            updatedBy: auth.userId,
          }),
        );
        await m.getRepository(StudentStatusHistory).save({
          studentId: s.id,
          fromStatus: null,
          toStatus: StudentStatus.APPLICANT,
          reason: 'Admission recorded',
          changedBy: auth.userId,
        });
        const after = await repo.findOneOrFail({ where: { id: s.id } });
        await this.audit.record(auth, { table: 'students', recordId: s.id, action: AuditAction.INSERT, after }, m);
        return s.id;
      }),
    );
    return this.get(id, auth);
  }

  async list(q: ListStudentsDto, auth: TenantAuth): Promise<Page<ReturnType<typeof toListItem>>> {
    const qb = this.scoped(this.ctx.repo(Student).createQueryBuilder('s'), auth, 'student.read')
      .innerJoinAndSelect('s.person', 'p')
      .leftJoinAndSelect('s.campus', 'c')
      .orderBy('p.display_name', 'ASC');
    if (q.status) qb.andWhere('s.status = :status', { status: q.status });
    if (q.campusId) qb.andWhere('s.campus_id = :campusId', { campusId: q.campusId });
    if (q.admissionType) qb.andWhere('s.admission_type = :at', { at: q.admissionType });
    if (q.search) {
      qb.andWhere(`(p.display_name ILIKE :s ESCAPE '\\' OR s.admission_no = :exact OR s.emis_id = :exact)`, {
        s: `%${escapeLike(q.search)}%`,
        exact: q.search,
      });
    }
    const [rows, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return { items: rows.map(toListItem), total, page: q.page, limit: q.limit };
  }

  async get(id: string, auth: TenantAuth) {
    const s = await this.scoped(this.ctx.repo(Student).createQueryBuilder('s'), auth, 'student.read')
      .leftJoinAndSelect('s.campus', 'c')
      .andWhere('s.id = :id', { id })
      .getOne();
    if (!s) throw new NotFoundException('Student not found');
    const person = (await this.persons.findFull(s.personId))!;
    return {
      id: s.id,
      admissionNo: s.admissionNo,
      emisId: s.emisId,
      status: s.status,
      admissionType: s.admissionType,
      admissionDate: s.admissionDate,
      previousSchoolName: s.previousSchoolName,
      previousSchoolClass: s.previousSchoolClass,
      previousTcNo: s.previousTcNo,
      hasSpecialNeeds: s.hasSpecialNeeds,
      leavingDate: s.leavingDate,
      leavingReason: s.leavingReason,
      tcIssuedNo: s.tcIssuedNo,
      remarks: s.remarks,
      campus: s.campus ? { id: s.campus.id, code: s.campus.code, name: s.campus.name } : null,
      person: toPersonView(person, auth),
      guardians: await this.guardianLinks(id),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async update(id: string, dto: UpdateStudentDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'student.update');
    if (dto.campusId !== undefined && dto.campusId !== before.campusId) {
      // Moving branches needs access to the destination too (and null = institution-level only).
      assertCanOnCampus(auth, 'student.update', dto.campusId);
      if (dto.campusId) await this.org.requireActiveCampus(dto.campusId);
    }
    const changes = defined(dto);
    this.assertTransferDetails({ ...before, ...changes });

    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        await m.getRepository(Student).update(id, { ...changes, updatedBy: auth.userId });
        const after = await m.getRepository(Student).findOneOrFail({ where: { id } });
        await this.audit.record(auth, { table: 'students', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      }),
    );
    return this.get(id, auth);
  }

  async changeStatus(id: string, dto: ChangeStudentStatusDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'student.update');
    if (dto.status === before.status) throw new BadRequestException(`Student is already ${dto.status}`);

    const exit = EXIT_STATUSES.has(dto.status);
    if (exit && !dto.leavingDate) throw new BadRequestException(`leavingDate is required for ${dto.status}`);
    if (!exit && (dto.leavingDate || dto.leavingReason || dto.tcIssuedNo)) {
      throw new BadRequestException('Leaving details only apply to alumni, transferred_out or dropped');
    }

    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        // Re-read under lock: two concurrent status changes must not both pass the guardian check.
        const locked = await m.getRepository(Student).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!locked || locked.status !== before.status) throw new ConflictException('Student was changed concurrently; retry');
        if (dto.status === StudentStatus.ACTIVE) await this.assertActivePrimaryGuardian(m, id);

        await m.getRepository(Student).update(id, {
          status: dto.status,
          // Leaving details are kept only while the student is out; readmission clears them.
          leavingDate: exit ? dto.leavingDate! : null,
          leavingReason: exit ? (dto.leavingReason ?? null) : null,
          tcIssuedNo: exit ? (dto.tcIssuedNo ?? before.tcIssuedNo) : before.tcIssuedNo,
          updatedBy: auth.userId,
        });
        await m.getRepository(StudentStatusHistory).save({
          studentId: id,
          fromStatus: before.status,
          toStatus: dto.status,
          reason: dto.reason ?? null,
          changedBy: auth.userId,
        });
        const after = await m.getRepository(Student).findOneOrFail({ where: { id } });
        await this.audit.record(auth, { table: 'students', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      }),
    );
    return this.get(id, auth);
  }

  async statusHistory(id: string, auth: TenantAuth) {
    await this.findVisible(id, auth, 'student.read');
    const rows = await this.ctx.repo(StudentStatusHistory).find({ where: { studentId: id }, order: { changedAt: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reason: r.reason,
      changedBy: r.changedBy,
      changedAt: r.changedAt,
    }));
  }

  /** Only applicants entered by mistake; real students leave through a status change and are kept. */
  async remove(id: string, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'student.delete');
    if (before.status !== StudentStatus.APPLICANT) {
      throw new ConflictException('Only applicants can be removed; use a status change (dropped, transferred_out) instead');
    }
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Student).softDelete(id);
      await this.audit.record(auth, { table: 'students', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- health (sensitive)

  async getHealth(id: string, auth: TenantAuth) {
    await this.findVisible(id, auth, 'student.health.read');
    const h = await this.ctx.repo(StudentHealth).findOne({ where: { studentId: id } });
    // The design asks for reads of medical data to be traceable.
    await this.audit.record(auth, { table: 'student_health', recordId: id, action: AuditAction.READ });
    return toHealthView(id, h);
  }

  async putHealth(id: string, dto: StudentHealthDto, auth: TenantAuth) {
    await this.findVisible(id, auth, 'student.health.update');
    const saved = await this.ctx.dataSource.transaction(async (m) => {
      const repo = m.getRepository(StudentHealth);
      const before = await repo.findOne({ where: { studentId: id } });
      const values = Object.fromEntries(HEALTH_FIELDS.map((k) => [k, dto[k] ?? null]));
      const h = await repo.save({ ...before, studentId: id, ...values, updatedBy: auth.userId });
      await this.audit.record(
        auth,
        { table: 'student_health', recordId: id, action: before ? AuditAction.UPDATE : AuditAction.INSERT, before, after: h },
        m,
      );
      return repo.findOneOrFail({ where: { studentId: id } });
    });
    return toHealthView(id, saved);
  }

  // ---------------------------------------------------------------- guardian links

  async listGuardians(id: string, auth: TenantAuth) {
    await this.findVisible(id, auth, 'student.read');
    return this.guardianLinks(id);
  }

  async addGuardian(id: string, dto: LinkGuardianDto, auth: TenantAuth) {
    const student = await this.findVisible(id, auth, 'student.update');
    if (!!dto.guardianId === !!dto.guardian) throw new BadRequestException('Provide exactly one of guardianId or guardian');
    this.assertValidity(dto.validFrom, dto.validTo);

    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        let guardian: Guardian | null;
        if (dto.guardian) {
          assertPermission(auth, 'guardian.create');
          guardian = await this.guardians.createInTx(m, dto.guardian, auth);
        } else {
          guardian = await m.getRepository(Guardian).findOne({ where: { id: dto.guardianId } });
          if (!guardian) throw new BadRequestException('Guardian not found');
        }
        if (guardian.personId === student.personId) throw new BadRequestException('A student cannot be their own guardian');

        const repo = m.getRepository(StudentGuardian);
        if (await repo.exists({ where: { studentId: id, guardianId: guardian.id } })) {
          throw new ConflictException('Guardian is already linked to this student');
        }
        if (dto.isPrimary) await repo.update({ studentId: id, isPrimary: true }, { isPrimary: false });
        const link = await repo.save(
          repo.create({
            ...defined(dto),
            guardian: undefined,
            guardianId: guardian.id,
            studentId: id,
            relation: dto.relation,
          }),
        );
        await this.audit.record(
          auth,
          { table: 'student_guardians', recordId: id, action: AuditAction.INSERT, after: link },
          m,
        );
      }),
    );
    return this.guardianLinks(id);
  }

  async updateGuardianLink(id: string, guardianId: string, dto: UpdateGuardianLinkDto, auth: TenantAuth) {
    const student = await this.findVisible(id, auth, 'student.update');
    const repo = this.ctx.repo(StudentGuardian);
    const before = await repo.findOne({ where: { studentId: id, guardianId } });
    if (!before) throw new NotFoundException('Guardian is not linked to this student');
    const merged = { ...before, ...defined(dto) };
    this.assertValidity(merged.validFrom, merged.validTo);
    const losesPrimary = before.isPrimary && (!merged.isPrimary || (merged.validTo !== null && merged.validTo < today()));
    if (losesPrimary && student.status === StudentStatus.ACTIVE) {
      throw new ConflictException('An active student needs a primary guardian; make another guardian primary first');
    }

    await this.write(() =>
      this.ctx.dataSource.transaction(async (m) => {
        const r = m.getRepository(StudentGuardian);
        if (dto.isPrimary && !before.isPrimary) await r.update({ studentId: id, isPrimary: true }, { isPrimary: false });
        const after = await r.save(merged);
        await this.audit.record(auth, { table: 'student_guardians', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      }),
    );
    return this.guardianLinks(id);
  }

  async removeGuardian(id: string, guardianId: string, auth: TenantAuth) {
    const student = await this.findVisible(id, auth, 'student.update');
    const before = await this.ctx.repo(StudentGuardian).findOne({ where: { studentId: id, guardianId } });
    if (!before) throw new NotFoundException('Guardian is not linked to this student');
    if (before.isPrimary && student.status === StudentStatus.ACTIVE) {
      throw new ConflictException('An active student needs a primary guardian; make another guardian primary first');
    }
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(StudentGuardian).delete({ studentId: id, guardianId });
      // The link row is gone; its full snapshot stays in audit_logs.
      await this.audit.record(auth, { table: 'student_guardians', recordId: id, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- helpers

  private guardianLinks(studentId: string) {
    return this.ctx.dataSource.query(
      `SELECT sg.guardian_id AS "guardianId", g.person_id AS "personId", p.display_name AS "displayName",
              (SELECT c.value FROM person_contacts c WHERE c.person_id = p.id AND c.deleted_at IS NULL
                 AND c.type IN ('phone', 'whatsapp') ORDER BY c.is_primary DESC, c.created_at ASC LIMIT 1) AS "primaryPhone",
              sg.relation, sg.is_primary AS "isPrimary", sg.is_emergency_contact AS "isEmergencyContact",
              sg.lives_with_student AS "livesWithStudent", sg.can_pickup AS "canPickup",
              sg.can_view_results AS "canViewResults", sg.can_pay_fees AS "canPayFees", sg.has_custody AS "hasCustody",
              to_char(sg.valid_from, 'YYYY-MM-DD') AS "validFrom", to_char(sg.valid_to, 'YYYY-MM-DD') AS "validTo",
              (${LINK_ACTIVE_SQL}) AS "isActive"
         FROM student_guardians sg
         JOIN guardians g ON g.id = sg.guardian_id
         JOIN persons p ON p.id = g.person_id
        WHERE sg.student_id = $1
        ORDER BY sg.is_primary DESC, p.display_name`,
      [studentId, today()],
    );
  }

  private async assertActivePrimaryGuardian(m: EntityManager, studentId: string) {
    const [{ ok }] = await m.query(
      `SELECT EXISTS (
         SELECT 1 FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id AND g.deleted_at IS NULL
          WHERE sg.student_id = $1 AND sg.is_primary AND ${LINK_ACTIVE_SQL}
       ) AS ok`,
      [studentId, today()],
    );
    if (!ok) throw new BadRequestException('Link a primary guardian before activating the student');
  }

  private assertTransferDetails(s: { admissionType?: AdmissionKind | null; previousSchoolName?: string | null; previousTcNo?: string | null }) {
    if (s.admissionType === AdmissionKind.TRANSFER_IN && (!s.previousSchoolName || !s.previousTcNo)) {
      throw new BadRequestException('transfer_in admissions need previousSchoolName and previousTcNo');
    }
  }

  private assertValidity(from: string | null | undefined, to: string | null | undefined) {
    if (from && to && to < from) throw new BadRequestException('validTo must be on or after validFrom');
  }

  private async findVisible(id: string, auth: TenantAuth, perm: string): Promise<Student> {
    const s = await this.scoped(this.ctx.repo(Student).createQueryBuilder('s'), auth, perm).andWhere('s.id = :id', { id }).getOne();
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }

  private scoped(qb: SelectQueryBuilder<Student>, auth: TenantAuth, perm: string) {
    const campusIds = campusScope(auth, perm);
    if (campusIds) qb.andWhere('s.campus_id = ANY(CAST(:campusIds AS uuid[]))', { campusIds });
    return qb;
  }

  /** Maps constraint violations to client errors. */
  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isUniqueViolation(e, 'uq_students_person_live')) throw new ConflictException('This person already has a student profile');
      if (isUniqueViolation(e, 'uq_students_emis_id_live')) throw new ConflictException('EMIS id already belongs to another student');
      if (isUniqueViolation(e, 'uq_student_guardians_primary')) throw new ConflictException('Another primary guardian was just set; retry');
      if (isUniqueViolation(e, 'pk_student_guardians')) throw new ConflictException('Guardian is already linked to this student');
      if (isCheckViolation(e)) throw new BadRequestException('Dates are inconsistent (e.g. leaving date before admission date)');
      throw e;
    }
  }
}
