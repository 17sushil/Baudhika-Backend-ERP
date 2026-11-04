import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../people/people.enums';
import { PersonDto } from '../../people/dto/person.response.dto';
import { CampusRefDto } from '../../organization/dto/organization.response.dto';
import { AdmissionKind, GuardianRelation, StudentStatus } from '../students.enums';

export class StudentPersonSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Ram Sharma' }) displayName: string;
  @ApiProperty({ enum: Gender, enumName: 'Gender', nullable: true }) gender: Gender | null;
  @ApiProperty({ type: String, nullable: true, example: '2015-04-14' }) dob: string | null;
}

export class StudentListItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ADM-2026-00031' }) admissionNo: string;
  @ApiProperty({ type: String, nullable: true }) emisId: string | null;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' }) status: StudentStatus;
  @ApiProperty({ enum: AdmissionKind, enumName: 'AdmissionKind' }) admissionType: AdmissionKind;
  @ApiProperty({ example: '2026-04-14' }) admissionDate: string;
  hasSpecialNeeds: boolean;
  @ApiProperty({ type: CampusRefDto, nullable: true }) campus: CampusRefDto | null;
  @ApiProperty({ type: StudentPersonSummaryDto }) person: StudentPersonSummaryDto;
  createdAt: Date;
}

export class StudentPageDto {
  @ApiProperty({ type: [StudentListItemDto] }) items: StudentListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class StudentGuardianLinkDto {
  @ApiProperty({ format: 'uuid' }) guardianId: string;
  @ApiProperty({ format: 'uuid' }) personId: string;
  @ApiProperty({ example: 'Sita Sharma' }) displayName: string;
  @ApiProperty({ type: String, nullable: true, example: '9841000000' }) primaryPhone: string | null;
  @ApiProperty({ enum: GuardianRelation, enumName: 'GuardianRelation' }) relation: GuardianRelation;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  livesWithStudent: boolean;
  canPickup: boolean;
  canViewResults: boolean;
  canPayFees: boolean;
  hasCustody: boolean;
  @ApiProperty({ type: String, nullable: true }) validFrom: string | null;
  @ApiProperty({ type: String, nullable: true }) validTo: string | null;
  /** Inside its validity window today. */
  isActive: boolean;
}

export class StudentDetailDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'ADM-2026-00031' }) admissionNo: string;
  @ApiProperty({ type: String, nullable: true }) emisId: string | null;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' }) status: StudentStatus;
  @ApiProperty({ enum: AdmissionKind, enumName: 'AdmissionKind' }) admissionType: AdmissionKind;
  @ApiProperty({ example: '2026-04-14' }) admissionDate: string;
  @ApiProperty({ type: String, nullable: true }) previousSchoolName: string | null;
  @ApiProperty({ type: String, nullable: true }) previousSchoolClass: string | null;
  @ApiProperty({ type: String, nullable: true }) previousTcNo: string | null;
  hasSpecialNeeds: boolean;
  @ApiProperty({ type: String, nullable: true }) leavingDate: string | null;
  @ApiProperty({ type: String, nullable: true }) leavingReason: string | null;
  @ApiProperty({ type: String, nullable: true }) tcIssuedNo: string | null;
  @ApiProperty({ type: String, nullable: true }) remarks: string | null;
  @ApiProperty({ type: CampusRefDto, nullable: true }) campus: CampusRefDto | null;
  @ApiProperty({ type: PersonDto }) person: PersonDto;
  @ApiProperty({ type: [StudentGuardianLinkDto] }) guardians: StudentGuardianLinkDto[];
  createdAt: Date;
  updatedAt: Date;
}

export class StudentStatusHistoryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus', nullable: true }) fromStatus: StudentStatus | null;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' }) toStatus: StudentStatus;
  @ApiProperty({ type: String, nullable: true }) reason: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) changedBy: string | null;
  changedAt: Date;
}

export class StudentHealthViewDto {
  @ApiProperty({ format: 'uuid' }) studentId: string;
  @ApiProperty({ type: String, nullable: true }) allergies: string | null;
  @ApiProperty({ type: String, nullable: true }) medicalConditions: string | null;
  @ApiProperty({ type: String, nullable: true }) medications: string | null;
  @ApiProperty({ type: String, nullable: true }) disabilityType: string | null;
  @ApiProperty({ type: String, nullable: true }) disabilityNotes: string | null;
  @ApiProperty({ type: String, nullable: true }) doctorName: string | null;
  @ApiProperty({ type: String, nullable: true }) doctorPhone: string | null;
  @ApiProperty({ type: String, nullable: true }) insuranceNo: string | null;
  @ApiProperty({ type: String, nullable: true }) emergencyInstructions: string | null;
  @ApiProperty({ type: Date, nullable: true }) updatedAt: Date | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) updatedBy: string | null;
}
