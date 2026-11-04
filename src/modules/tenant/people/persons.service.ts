import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import type { Page } from '../../../common/dto/pagination.dto';
import { today } from '../../../common/utils/date.util';
import { defined } from '../../../common/utils/object.util';
import { escapeLike, isUniqueViolation } from '../../../common/utils/sql.util';
import { normalizePhone, PHONE_RE } from '../access/identifier.util';
import { campusScope, hasPermission } from '../access/scope.util';
import { User } from '../access/entities/user.tenant.entity';
import { AuditAction } from '../audit/audit.enums';
import { AuditService } from '../audit/audit.service';
import type { TenantAuth } from '../auth/auth.types';
import { TenantContext } from '../context/tenant-context';
import {
  AddressInputDto,
  ContactInputDto,
  ListPersonsDto,
  PersonInputDto,
  PersonRefDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdatePersonDto,
} from './dto/person.dto';
import { PersonAddress } from './entities/person-address.tenant.entity';
import { PersonContact } from './entities/person-contact.tenant.entity';
import { Person } from './entities/person.tenant.entity';
import { ContactKind } from './people.enums';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE = ['religion', 'ethnicity'] as const;

/**
 * SQL condition: person is connected to one of :campusIds (as student, staff, or guardian of a student
 * there), or has no profile yet (just created, not linked).
 */
export function personInCampusesSql(alias: string) {
  return `(
    EXISTS (SELECT 1 FROM students s WHERE s.person_id = ${alias}.id AND s.deleted_at IS NULL AND s.campus_id = ANY(CAST(:campusIds AS uuid[])))
    OR EXISTS (SELECT 1 FROM staff st WHERE st.person_id = ${alias}.id AND st.deleted_at IS NULL AND st.campus_id = ANY(CAST(:campusIds AS uuid[])))
    OR EXISTS (SELECT 1 FROM guardians g JOIN student_guardians sg ON sg.guardian_id = g.id JOIN students s2 ON s2.id = sg.student_id
               WHERE g.person_id = ${alias}.id AND g.deleted_at IS NULL AND s2.deleted_at IS NULL
                 AND s2.campus_id = ANY(CAST(:campusIds AS uuid[])))
    OR NOT EXISTS (
      SELECT 1 FROM students s3 WHERE s3.person_id = ${alias}.id AND s3.deleted_at IS NULL
      UNION ALL SELECT 1 FROM staff st3 WHERE st3.person_id = ${alias}.id AND st3.deleted_at IS NULL
      UNION ALL SELECT 1 FROM guardians g3 WHERE g3.person_id = ${alias}.id AND g3.deleted_at IS NULL)
  )`;
}

export const toContactView = (c: PersonContact) => ({
  id: c.id,
  type: c.type,
  value: c.value,
  isPrimary: c.isPrimary,
  verifiedAt: c.verifiedAt,
});

export const toAddressView = (a: PersonAddress) => ({
  id: a.id,
  type: a.type,
  line1: a.line1,
  line2: a.line2,
  ward: a.ward,
  municipality: a.municipality,
  district: a.district,
  province: a.province,
  postalCode: a.postalCode,
  country: a.country,
  latitude: a.latitude === null ? null : +a.latitude,
  longitude: a.longitude === null ? null : +a.longitude,
});

/** Person view; religion/ethnicity only for holders of person.sensitive.read. */
export function toPersonView(p: Person, auth: TenantAuth) {
  const sensitive = hasPermission(auth, 'person.sensitive.read');
  return {
    id: p.id,
    userId: p.userId,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    displayName: p.displayName,
    gender: p.gender,
    dob: p.dob,
    birthPlace: p.birthPlace,
    bloodGroup: p.bloodGroup,
    nationality: p.nationality,
    nationalId: p.nationalId,
    motherTongue: p.motherTongue,
    ...(sensitive ? { religion: p.religion, ethnicity: p.ethnicity } : {}),
    photoFileId: p.photoFileId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(p.contacts ? { contacts: p.contacts.filter((c) => !c.deletedAt).map(toContactView) } : {}),
    ...(p.addresses ? { addresses: p.addresses.filter((a) => !a.deletedAt).map(toAddressView) } : {}),
  };
}

@Injectable()
export class PersonsService {
  constructor(
    private ctx: TenantContext,
    private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- building blocks for profile modules

  /** Resolves "personId or person" inside a transaction; creates the person when given inline. */
  async resolveRef(m: EntityManager, ref: PersonRefDto, auth: TenantAuth): Promise<Person> {
    if (!!ref.personId === !!ref.person) throw new BadRequestException('Provide exactly one of personId or person');
    if (ref.personId) {
      const p = await m.getRepository(Person).findOne({ where: { id: ref.personId } });
      if (!p) throw new BadRequestException('Person not found');
      return p;
    }
    if (!hasPermission(auth, 'person.create')) throw new ForbiddenException('Missing permission: person.create');
    return this.createInTx(m, ref.person!, auth);
  }

  async createInTx(m: EntityManager, dto: PersonInputDto, auth: TenantAuth): Promise<Person> {
    this.assertSensitiveWrite(dto, auth);
    this.assertDob(dto.dob);
    const { contacts = [], addresses = [], ...fields } = defined(dto);
    const contactRows = contacts.map((c) => this.normalizeContact(c));
    for (const type of Object.values(ContactKind)) {
      if (contactRows.filter((c) => c.type === type && c.isPrimary).length > 1) {
        throw new BadRequestException(`Only one primary ${type} contact allowed`);
      }
    }

    const repo = m.getRepository(Person);
    const saved = await repo.save(repo.create({ ...fields, createdBy: auth.userId, updatedBy: auth.userId }));
    if (contactRows.length) {
      await m.getRepository(PersonContact).save(contactRows.map((c) => ({ ...c, personId: saved.id })));
    }
    if (addresses.length) {
      await m.getRepository(PersonAddress).save(addresses.map((a) => this.addressRow(a, saved.id)));
    }
    const person = await repo.findOneOrFail({ where: { id: saved.id } });
    await this.audit.record(auth, { table: 'persons', recordId: person.id, action: AuditAction.INSERT, after: person }, m);
    return person;
  }

  /** Students must have first name, date of birth and gender (government reports). */
  assertStudentReady(p: Pick<Person, 'firstName' | 'dob' | 'gender'>) {
    if (!p.firstName || !p.dob || !p.gender) {
      throw new BadRequestException('A student needs first name, date of birth and gender');
    }
  }

  /** Loads a person with live contacts and addresses. */
  findFull(id: string, m: EntityManager = this.ctx.dataSource.manager) {
    return m
      .getRepository(Person)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.contacts', 'c', 'c.deleted_at IS NULL')
      .leftJoinAndSelect('p.addresses', 'a', 'a.deleted_at IS NULL')
      .where('p.id = :id', { id })
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('a.created_at', 'ASC')
      .getOne();
  }

  // ---------------------------------------------------------------- endpoints

  /** Admission helper: find people by an exact contact value, across the whole school. Minimal fields only. */
  async lookup(contact: string) {
    const value = contact.includes('@') ? contact.toLowerCase() : normalizePhone(contact);
    const rows: { id: string; displayName: string; gender: string | null; studentId: string | null; guardianId: string | null; staffId: string | null }[] =
      await this.ctx.dataSource.query(
        `SELECT p.id, p.display_name AS "displayName", p.gender,
                (SELECT s.id FROM students s WHERE s.person_id = p.id AND s.deleted_at IS NULL) AS "studentId",
                (SELECT g.id FROM guardians g WHERE g.person_id = p.id AND g.deleted_at IS NULL) AS "guardianId",
                (SELECT st.id FROM staff st WHERE st.person_id = p.id AND st.deleted_at IS NULL) AS "staffId"
           FROM persons p
          WHERE p.deleted_at IS NULL
            AND EXISTS (SELECT 1 FROM person_contacts c WHERE c.person_id = p.id AND c.deleted_at IS NULL AND c.value = $1)
          ORDER BY p.display_name
          LIMIT 20`,
        [value],
      );
    return rows;
  }

  async list(q: ListPersonsDto, auth: TenantAuth): Promise<Page<ReturnType<typeof toPersonView>>> {
    const qb = this.scoped(this.ctx.repo(Person).createQueryBuilder('p'), auth, 'person.read').orderBy('p.display_name', 'ASC');
    if (q.search) qb.andWhere(`p.display_name ILIKE :s ESCAPE '\\'`, { s: `%${escapeLike(q.search)}%` });
    const [rows, total] = await qb.skip((q.page - 1) * q.limit).take(q.limit).getManyAndCount();
    return { items: rows.map((p) => toPersonView(p, auth)), total, page: q.page, limit: q.limit };
  }

  async get(id: string, auth: TenantAuth) {
    await this.findVisible(id, auth, 'person.read');
    const p = (await this.findFull(id))!;
    const [profiles] = await this.ctx.dataSource.query(
      `SELECT (SELECT s.id FROM students s WHERE s.person_id = $1 AND s.deleted_at IS NULL) AS "studentId",
              (SELECT g.id FROM guardians g WHERE g.person_id = $1 AND g.deleted_at IS NULL) AS "guardianId",
              (SELECT st.id FROM staff st WHERE st.person_id = $1 AND st.deleted_at IS NULL) AS "staffId"`,
      [id],
    );
    return { ...toPersonView(p, auth), profiles };
  }

  async create(dto: PersonInputDto, auth: TenantAuth) {
    const p = await this.ctx.dataSource.transaction((m) => this.createInTx(m, dto, auth));
    return this.get(p.id, auth);
  }

  async update(id: string, dto: UpdatePersonDto, auth: TenantAuth) {
    const before = await this.findVisible(id, auth, 'person.update');
    this.assertSensitiveWrite(dto, auth);
    this.assertDob(dto.dob);
    const changes = defined(dto);
    const [{ isStudent }] = await this.ctx.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM students WHERE person_id = $1 AND deleted_at IS NULL) AS "isStudent"`,
      [id],
    );
    if (isStudent) this.assertStudentReady({ ...before, ...changes } as Person);

    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(Person).update(id, { ...changes, updatedBy: auth.userId });
      const after = await m.getRepository(Person).findOneOrFail({ where: { id } });
      await this.audit.record(auth, { table: 'persons', recordId: id, action: AuditAction.UPDATE, before, after }, m);
    });
    return this.get(id, auth);
  }

  /** Portal access: binds a login to this person (one login per person, one person per login). */
  async linkUser(id: string, userId: string | null | undefined, auth: TenantAuth) {
    if (userId === undefined) throw new BadRequestException('userId is required (null to unlink)');
    const before = await this.ctx.repo(Person).findOne({ where: { id } });
    if (!before) throw new NotFoundException('Person not found');
    if (userId && !(await this.ctx.repo(User).exists({ where: { id: userId } }))) {
      throw new BadRequestException('User not found');
    }
    try {
      await this.ctx.dataSource.transaction(async (m) => {
        await m.getRepository(Person).update(id, { userId, updatedBy: auth.userId });
        const after = await m.getRepository(Person).findOneOrFail({ where: { id } });
        await this.audit.record(auth, { table: 'persons', recordId: id, action: AuditAction.UPDATE, before, after }, m);
      });
    } catch (e) {
      if (isUniqueViolation(e, 'uq_persons_user_live')) throw new ConflictException('That login already belongs to another person');
      throw e;
    }
    return this.get(id, auth);
  }

  // ---- contacts

  async addContact(personId: string, dto: ContactInputDto, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const row = this.normalizeContact(dto);
    const saved = await this.unique(() =>
      this.ctx.dataSource.transaction(async (m) => {
        if (row.isPrimary) await this.demotePrimary(m, personId, row.type);
        const c = await m.getRepository(PersonContact).save({ ...row, personId });
        await this.audit.record(auth, { table: 'person_contacts', recordId: c.id, action: AuditAction.INSERT, after: c }, m);
        return c;
      }),
    );
    return toContactView(saved);
  }

  async updateContact(personId: string, contactId: string, dto: UpdateContactDto, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const before = await this.ctx.repo(PersonContact).findOne({ where: { id: contactId, personId } });
    if (!before) throw new NotFoundException('Contact not found');
    const value = dto.value === undefined ? before.value : this.normalizeContact({ type: before.type, value: dto.value }).value;
    const saved = await this.unique(() =>
      this.ctx.dataSource.transaction(async (m) => {
        if (dto.isPrimary && !before.isPrimary) await this.demotePrimary(m, personId, before.type);
        const c = await m.getRepository(PersonContact).save({ ...before, value, isPrimary: dto.isPrimary ?? before.isPrimary });
        await this.audit.record(auth, { table: 'person_contacts', recordId: c.id, action: AuditAction.UPDATE, before, after: c }, m);
        return c;
      }),
    );
    return toContactView(saved);
  }

  async removeContact(personId: string, contactId: string, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const before = await this.ctx.repo(PersonContact).findOne({ where: { id: contactId, personId } });
    if (!before) throw new NotFoundException('Contact not found');
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(PersonContact).softDelete(contactId);
      await this.audit.record(auth, { table: 'person_contacts', recordId: contactId, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---- addresses

  async addAddress(personId: string, dto: AddressInputDto, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const saved = await this.ctx.dataSource.transaction(async (m) => {
      const a = await m.getRepository(PersonAddress).save(this.addressRow(dto, personId));
      await this.audit.record(auth, { table: 'person_addresses', recordId: a.id, action: AuditAction.INSERT, after: a }, m);
      return a;
    });
    return toAddressView(saved);
  }

  async updateAddress(personId: string, addressId: string, dto: UpdateAddressDto, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const before = await this.ctx.repo(PersonAddress).findOne({ where: { id: addressId, personId } });
    if (!before) throw new NotFoundException('Address not found');
    const changes = defined(dto);
    const saved = await this.ctx.dataSource.transaction(async (m) => {
      const a = await m.getRepository(PersonAddress).save({
        ...before,
        ...changes,
        latitude: changes.latitude === undefined ? before.latitude : changes.latitude === null ? null : String(changes.latitude),
        longitude: changes.longitude === undefined ? before.longitude : changes.longitude === null ? null : String(changes.longitude),
      });
      await this.audit.record(auth, { table: 'person_addresses', recordId: a.id, action: AuditAction.UPDATE, before, after: a }, m);
      return a;
    });
    return toAddressView(saved);
  }

  async removeAddress(personId: string, addressId: string, auth: TenantAuth) {
    await this.findVisible(personId, auth, 'person.update');
    const before = await this.ctx.repo(PersonAddress).findOne({ where: { id: addressId, personId } });
    if (!before) throw new NotFoundException('Address not found');
    await this.ctx.dataSource.transaction(async (m) => {
      await m.getRepository(PersonAddress).softDelete(addressId);
      await this.audit.record(auth, { table: 'person_addresses', recordId: addressId, action: AuditAction.DELETE, before }, m);
    });
  }

  // ---------------------------------------------------------------- helpers

  /** 404 unless the person exists and is inside the caller's campus scope for this permission. */
  private async findVisible(id: string, auth: TenantAuth, perm: string): Promise<Person> {
    const p = await this.scoped(this.ctx.repo(Person).createQueryBuilder('p'), auth, perm).andWhere('p.id = :id', { id }).getOne();
    if (!p) throw new NotFoundException('Person not found');
    return p;
  }

  private scoped(qb: SelectQueryBuilder<Person>, auth: TenantAuth, perm: string) {
    const campusIds = campusScope(auth, perm);
    if (campusIds) qb.andWhere(personInCampusesSql('p'), { campusIds });
    return qb;
  }

  private assertSensitiveWrite(dto: Partial<Record<(typeof SENSITIVE)[number], unknown>>, auth: TenantAuth) {
    if (SENSITIVE.some((k) => dto[k] !== undefined) && !hasPermission(auth, 'person.sensitive.read')) {
      throw new ForbiddenException('Religion and ethnicity need person.sensitive.read');
    }
  }

  private assertDob(dob: string | null | undefined) {
    if (dob && dob > today()) throw new BadRequestException('Date of birth cannot be in the future');
  }

  private normalizeContact(c: Pick<ContactInputDto, 'type' | 'value' | 'isPrimary'>) {
    const raw = c.value.trim();
    if (c.type === ContactKind.EMAIL) {
      const value = raw.toLowerCase();
      if (!EMAIL_RE.test(value) || value.length > 254) throw new BadRequestException('Invalid email address');
      return { type: c.type, value, isPrimary: c.isPrimary ?? false };
    }
    const value = normalizePhone(raw);
    if (!PHONE_RE.test(value)) throw new BadRequestException('Phone must be 7-15 digits, optional leading +');
    return { type: c.type, value, isPrimary: c.isPrimary ?? false };
  }

  private addressRow(a: AddressInputDto, personId: string) {
    return {
      ...defined(a),
      personId,
      latitude: a.latitude == null ? null : String(a.latitude),
      longitude: a.longitude == null ? null : String(a.longitude),
    };
  }

  private demotePrimary(m: EntityManager, personId: string, type: ContactKind) {
    return m.getRepository(PersonContact).update({ personId, type, isPrimary: true }, { isPrimary: false });
  }

  private async unique<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isUniqueViolation(e, 'uq_person_contacts_primary')) throw new ConflictException('Another primary contact of this type was just set');
      throw e;
    }
  }
}
