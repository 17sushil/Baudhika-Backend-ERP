import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '../../people/people.enums';
import { PersonDto } from '../../people/dto/person.response.dto';
import { CampusRefDto } from '../../organization/dto/organization.response.dto';
import { EmploymentKind, StaffKind, StaffStatus } from '../staff.enums';

export class NamedRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Science' }) name: string;
}

export class StaffPersonSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Sita Sharma' }) displayName: string;
  @ApiProperty({ enum: Gender, enumName: 'Gender', nullable: true }) gender: Gender | null;
}

export class StaffListItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'EMP-0012' }) employeeCode: string;
  @ApiProperty({ enum: StaffKind, enumName: 'StaffKind' }) staffType: StaffKind;
  @ApiProperty({ enum: StaffStatus, enumName: 'StaffStatus' }) status: StaffStatus;
  @ApiProperty({ enum: EmploymentKind, enumName: 'EmploymentKind', nullable: true }) employmentType: EmploymentKind | null;
  @ApiProperty({ example: '2026-04-01' }) joiningDate: string;
  @ApiProperty({ type: CampusRefDto, nullable: true }) campus: CampusRefDto | null;
  @ApiProperty({ type: NamedRefDto, nullable: true }) department: NamedRefDto | null;
  @ApiProperty({ type: NamedRefDto, nullable: true }) designation: NamedRefDto | null;
  @ApiProperty({ type: StaffPersonSummaryDto }) person: StaffPersonSummaryDto;
  createdAt: Date;
}

export class StaffPageDto {
  @ApiProperty({ type: [StaffListItemDto] }) items: StaffListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class TeacherProfileViewDto {
  @ApiProperty({ type: String, nullable: true }) highestQualification: string | null;
  @ApiProperty({ type: String, nullable: true }) specialization: string | null;
  @ApiProperty({ type: Number, nullable: true }) experienceYears: number | null;
  @ApiProperty({ type: Number, nullable: true }) maxWeeklyPeriods: number | null;
  @ApiProperty({ type: String, nullable: true }) teachingLicenseNo: string | null;
}

export class DriverProfileViewDto {
  @ApiProperty() licenseNo: string;
  @ApiProperty({ type: String, nullable: true }) licenseClass: string | null;
  @ApiProperty({ example: '2029-12-31' }) licenseExpiry: string;
  @ApiProperty({ type: String, nullable: true }) medicalFitnessExpiry: string | null;
  @ApiProperty({ type: String, nullable: true }) policeVerificationDate: string | null;
}

export class QualificationViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'B.Ed.' }) degree: string;
  @ApiProperty({ type: String, nullable: true }) institution: string | null;
  @ApiProperty({ type: Number, nullable: true }) passedYear: number | null;
  @ApiProperty({ type: String, nullable: true }) grade: string | null;
  createdAt: Date;
}

export class ManagerRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'EMP-0001' }) employeeCode: string;
  @ApiProperty({ type: String, nullable: true }) displayName: string | null;
}

export class StaffDetailDto extends StaffListItemDto {
  @ApiProperty({ type: String, nullable: true }) probationEndDate: string | null;
  @ApiProperty({ type: String, nullable: true }) leavingDate: string | null;
  @ApiProperty({ type: String, nullable: true }) leavingReason: string | null;
  @ApiProperty({ type: String, nullable: true }) emergencyContactName: string | null;
  @ApiProperty({ type: String, nullable: true }) emergencyContactPhone: string | null;
  @ApiProperty({ type: ManagerRefDto, nullable: true }) manager: ManagerRefDto | null;
  @ApiProperty({ example: 0 }) directReports: number;
  @ApiProperty({ type: PersonDto }) declare person: PersonDto;
  @ApiProperty({ type: TeacherProfileViewDto, nullable: true }) teacherProfile: TeacherProfileViewDto | null;
  @ApiProperty({ type: DriverProfileViewDto, nullable: true }) driverProfile: DriverProfileViewDto | null;
  @ApiProperty({ type: [QualificationViewDto] }) qualifications: QualificationViewDto[];
  updatedAt: Date;
}
