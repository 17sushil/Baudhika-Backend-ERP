import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { IsDateOnly, IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';
import { normalizePhone, PHONE_RE } from '../../access/identifier.util';
import { PersonRefDto } from '../../people/dto/person.dto';
import { EmploymentKind, StaffKind, StaffStatus } from '../staff.enums';

const phone = () => Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value));

export class TeacherProfileDto {
  @ApiPropertyOptional({ example: 'M.Ed.' }) @IsOptional() @Trim() @IsString() @MaxLength(150) highestQualification?: string | null;
  @ApiPropertyOptional({ example: 'Mathematics' }) @IsOptional() @Trim() @IsString() @MaxLength(150) specialization?: string | null;
  @ApiPropertyOptional({ example: 6.5, minimum: 0, maximum: 999.9 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @Max(999.9) experienceYears?: number | null;
  @ApiPropertyOptional({ example: 30, minimum: 0, maximum: 100 }) @IsOptional() @IsInt() @Min(0) @Max(100) maxWeeklyPeriods?: number | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) teachingLicenseNo?: string | null;
}

export class DriverProfileDto {
  @ApiProperty({ example: '01-06-12345678' }) @Trim() @IsString() @Length(3, 50) licenseNo: string;
  @ApiPropertyOptional({ example: 'B, C' }) @IsOptional() @Trim() @IsString() @MaxLength(50) licenseClass?: string | null;
  @ApiProperty({ example: '2029-12-31', description: 'Must not be expired' }) @IsDateOnly() licenseExpiry: string;
  @IsOptional() @IsDateOnly() medicalFitnessExpiry?: string | null;
  @IsOptional() @IsDateOnly() policeVerificationDate?: string | null;
}

/** personId (reuse) or person (create) + employment details. employee_code is generated (EMP-0012). */
export class CreateStaffDto extends PersonRefDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Campus of work. Branch-scoped users must pick one of their campuses.' })
  @IsOptional() @IsUUID() campusId?: string;
  @ApiProperty({ enum: StaffKind, enumName: 'StaffKind', example: StaffKind.TEACHING }) @IsEnum(StaffKind) staffType: StaffKind;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() designationId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', description: 'Direct manager (another staff id)' }) @IsOptional() @IsUUID() reportsTo?: string | null;
  @ApiPropertyOptional({ enum: EmploymentKind, enumName: 'EmploymentKind' }) @IsOptional() @IsEnum(EmploymentKind) employmentType?: EmploymentKind | null;
  @ApiProperty({ example: '2026-04-01' }) @IsDateOnly() joiningDate: string;
  @IsOptional() @IsDateOnly() probationEndDate?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(150) emergencyContactName?: string | null;
  @ApiPropertyOptional({ pattern: PHONE_RE.source })
  @IsOptional() @phone() @Matches(PHONE_RE, { message: 'emergencyContactPhone must be 7-15 digits, optional leading +' })
  emergencyContactPhone?: string | null;
  /** Required when staffType = teaching (may be {}). */
  @ApiPropertyOptional({ type: TeacherProfileDto }) @IsOptional() @ValidateNested() @Type(() => TeacherProfileDto) teacherProfile?: TeacherProfileDto;
  /** Required when staffType = driver. */
  @ApiPropertyOptional({ type: DriverProfileDto }) @IsOptional() @ValidateNested() @Type(() => DriverProfileDto) driverProfile?: DriverProfileDto;
}

/** Status/leaving details change via POST /staff/:id/status. */
export class UpdateStaffDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() campusId?: string | null;
  @ApiPropertyOptional({ enum: StaffKind, enumName: 'StaffKind' }) @IsOptionalNonNull() @IsEnum(StaffKind) staffType?: StaffKind;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() departmentId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() designationId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() reportsTo?: string | null;
  @ApiPropertyOptional({ enum: EmploymentKind, enumName: 'EmploymentKind', nullable: true })
  @IsOptional() @IsEnum(EmploymentKind) employmentType?: EmploymentKind | null;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsDateOnly() joiningDate?: string;
  @IsOptional() @IsDateOnly() probationEndDate?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(150) emergencyContactName?: string | null;
  @ApiPropertyOptional({ pattern: PHONE_RE.source })
  @IsOptional() @phone() @Matches(PHONE_RE, { message: 'emergencyContactPhone must be 7-15 digits, optional leading +' })
  emergencyContactPhone?: string | null;
  /** Provide when switching staffType to teaching and no profile exists yet. */
  @ApiPropertyOptional({ type: TeacherProfileDto }) @IsOptional() @ValidateNested() @Type(() => TeacherProfileDto) teacherProfile?: TeacherProfileDto;
  /** Provide when switching staffType to driver and no profile exists yet. */
  @ApiPropertyOptional({ type: DriverProfileDto }) @IsOptional() @ValidateNested() @Type(() => DriverProfileDto) driverProfile?: DriverProfileDto;
}

export class ChangeStaffStatusDto {
  @ApiProperty({ enum: StaffStatus, enumName: 'StaffStatus', example: StaffStatus.ON_LEAVE }) @IsEnum(StaffStatus) status: StaffStatus;
  /** Required for resigned, terminated, retired. */
  @IsOptional() @IsDateOnly() leavingDate?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(500) leavingReason?: string | null;
}

export class QualificationDto {
  @ApiProperty({ example: 'B.Ed.' }) @Trim() @IsString() @Length(1, 150) degree: string;
  @ApiPropertyOptional({ example: 'Tribhuvan University' }) @IsOptional() @Trim() @IsString() @MaxLength(200) institution?: string | null;
  @ApiPropertyOptional({ example: 2018 }) @IsOptional() @IsInt() @Min(1900) @Max(2200) passedYear?: number | null;
  @ApiPropertyOptional({ example: 'First Division' }) @IsOptional() @Trim() @IsString() @MaxLength(50) grade?: string | null;
}

export class UpdateQualificationDto {
  @ApiPropertyOptional() @IsOptionalNonNull() @Trim() @IsString() @Length(1, 150) degree?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(200) institution?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2200) passedYear?: number | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) grade?: string | null;
}

export class ListStaffDto extends PaginationQueryDto {
  /** Name contains, or exact employee code. */
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: StaffKind, enumName: 'StaffKind' }) @IsOptional() @IsEnum(StaffKind) staffType?: StaffKind;
  @ApiPropertyOptional({ enum: StaffStatus, enumName: 'StaffStatus' }) @IsOptional() @IsEnum(StaffStatus) status?: StaffStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() campusId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() designationId?: string;
}
