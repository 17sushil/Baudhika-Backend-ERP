import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { IsDateOnly, IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';
import { normalizePhone, PHONE_RE } from '../../access/identifier.util';
import { CreateGuardianDto } from '../../guardians/dto/guardian.dto';
import { PersonRefDto } from '../../people/dto/person.dto';
import { AdmissionKind, GuardianRelation, StudentStatus } from '../students.enums';

export const EMIS_RE = /^[0-9A-Za-z-]{1,30}$/;

/** personId (reuse) or person (create; needs firstName, dob, gender) + admission details. Starts as applicant. */
export class CreateStudentDto extends PersonRefDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Campus of admission. Branch-scoped users must pick one of their campuses.' })
  @IsOptional() @IsUUID() campusId?: string;
  @ApiProperty({ example: '2026-04-14' }) @IsDateOnly() admissionDate: string;
  @ApiPropertyOptional({ enum: AdmissionKind, enumName: 'AdmissionKind', default: AdmissionKind.NEW })
  @IsOptional() @IsEnum(AdmissionKind) admissionType?: AdmissionKind;
  @ApiPropertyOptional({ example: '0123456789', pattern: EMIS_RE.source, description: 'Government EMIS id, typed when issued' })
  @IsOptional() @Trim() @Matches(EMIS_RE, { message: 'emisId: 1-30 letters, digits or -' }) emisId?: string | null;
  /** Required for transfer_in. */
  @ApiPropertyOptional({ example: 'Everest English School' }) @IsOptional() @Trim() @IsString() @MaxLength(200) previousSchoolName?: string | null;
  @ApiPropertyOptional({ example: 'Grade 4' }) @IsOptional() @Trim() @IsString() @MaxLength(50) previousSchoolClass?: string | null;
  /** Required for transfer_in. */
  @ApiPropertyOptional({ example: 'TC-2026-118' }) @IsOptional() @Trim() @IsString() @MaxLength(50) previousTcNo?: string | null;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() hasSpecialNeeds?: boolean;
  @IsOptional() @Trim() @IsString() @MaxLength(2000) remarks?: string | null;
}

/** Status, admission number and leaving details change only through their own endpoints. */
export class UpdateStudentDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() campusId?: string | null;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsDateOnly() admissionDate?: string;
  @ApiPropertyOptional({ enum: AdmissionKind, enumName: 'AdmissionKind' }) @IsOptionalNonNull() @IsEnum(AdmissionKind) admissionType?: AdmissionKind;
  @ApiPropertyOptional({ pattern: EMIS_RE.source, nullable: true })
  @IsOptional() @Trim() @Matches(EMIS_RE, { message: 'emisId: 1-30 letters, digits or -' }) emisId?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(200) previousSchoolName?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) previousSchoolClass?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) previousTcNo?: string | null;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() hasSpecialNeeds?: boolean;
  @IsOptional() @Trim() @IsString() @MaxLength(2000) remarks?: string | null;
}

export class ChangeStudentStatusDto {
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus', example: StudentStatus.ACTIVE }) @IsEnum(StudentStatus) status: StudentStatus;
  @ApiPropertyOptional({ example: 'Family moved to Kathmandu' }) @IsOptional() @Trim() @IsString() @MaxLength(500) reason?: string | null;
  /** Required for alumni, transferred_out and dropped. */
  @ApiPropertyOptional({ example: '2027-03-30' }) @IsOptional() @IsDateOnly() leavingDate?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(500) leavingReason?: string | null;
  /** Transfer certificate number this school issued on exit. */
  @ApiPropertyOptional({ example: 'TC-2027-004' }) @IsOptional() @Trim() @IsString() @MaxLength(50) tcIssuedNo?: string | null;
}

export class ListStudentsDto extends PaginationQueryDto {
  /** Name contains, or exact admission number / EMIS id. */
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: StudentStatus, enumName: 'StudentStatus' }) @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() campusId?: string;
  @ApiPropertyOptional({ enum: AdmissionKind, enumName: 'AdmissionKind' }) @IsOptional() @IsEnum(AdmissionKind) admissionType?: AdmissionKind;
}

const phone = () => Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value));

/** PUT semantics: the whole record is replaced; omitted fields become empty. */
export class StudentHealthDto {
  @ApiPropertyOptional({ example: 'Peanuts' }) @IsOptional() @Trim() @IsString() @MaxLength(1000) allergies?: string | null;
  @ApiPropertyOptional({ example: 'Asthma' }) @IsOptional() @Trim() @IsString() @MaxLength(1000) medicalConditions?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(1000) medications?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(200) disabilityType?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(1000) disabilityNotes?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(150) doctorName?: string | null;
  @ApiPropertyOptional({ example: '9851000000', pattern: PHONE_RE.source })
  @IsOptional() @phone() @Matches(PHONE_RE, { message: 'doctorPhone must be 7-15 digits, optional leading +' }) doctorPhone?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) insuranceNo?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(1000) emergencyInstructions?: string | null;
}

export class GuardianLinkFlagsDto {
  @ApiPropertyOptional({ default: false, description: 'Only one primary per student; setting it demotes the previous one' })
  @IsOptionalNonNull() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptionalNonNull() @IsBoolean() isEmergencyContact?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptionalNonNull() @IsBoolean() livesWithStudent?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptionalNonNull() @IsBoolean() canPickup?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptionalNonNull() @IsBoolean() canViewResults?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptionalNonNull() @IsBoolean() canPayFees?: boolean;
  @ApiPropertyOptional({ default: true, description: 'Set false for a non-custodial parent after a separation order' })
  @IsOptionalNonNull() @IsBoolean() hasCustody?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateOnly() validFrom?: string | null;
  /** After this date the guardian loses access. */
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateOnly() validTo?: string | null;
}

/** Link an existing guardian (guardianId) or create one inline (guardian). Exactly one. */
export class LinkGuardianDto extends GuardianLinkFlagsDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() guardianId?: string;
  @ApiPropertyOptional({ type: CreateGuardianDto, description: 'Create a guardian (and person) inline; needs guardian.create' })
  @IsOptional() @ValidateNested() @Type(() => CreateGuardianDto) guardian?: CreateGuardianDto;
  @ApiProperty({ enum: GuardianRelation, enumName: 'GuardianRelation', example: GuardianRelation.MOTHER }) @IsEnum(GuardianRelation) relation: GuardianRelation;
}

export class UpdateGuardianLinkDto extends GuardianLinkFlagsDto {
  @ApiPropertyOptional({ enum: GuardianRelation, enumName: 'GuardianRelation' }) @IsOptionalNonNull() @IsEnum(GuardianRelation) relation?: GuardianRelation;
}
