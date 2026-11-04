import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonDto } from '../../people/dto/person.response.dto';
import { GuardianRelation, StudentStatus } from '../../students/students.enums';

export class PersonSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Sita Sharma' }) displayName: string;
  @ApiProperty({ type: String, nullable: true, example: '9841000000' }) primaryPhone: string | null;
}

export class GuardianChildDto {
  @ApiProperty({ format: 'uuid' }) studentId: string;
  @ApiProperty({ example: 'ADM-2026-00031' }) admissionNo: string;
  @ApiProperty({ example: 'Ram Sharma' }) displayName: string;
  @ApiProperty({ enum: StudentStatus, enumName: 'StudentStatus' }) status: StudentStatus;
  @ApiProperty({ enum: GuardianRelation, enumName: 'GuardianRelation' }) relation: GuardianRelation;
  isPrimary: boolean;
}

export class GuardianDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) personId: string;
  @ApiProperty({ type: String, nullable: true }) qualification: string | null;
  @ApiProperty({ type: String, nullable: true }) occupation: string | null;
  @ApiProperty({ type: String, nullable: true }) employer: string | null;
  /** Present only for holders of guardian.sensitive.read. */
  @ApiPropertyOptional({ type: Number, nullable: true, example: 850000 }) annualIncome?: number | null;
  createdAt: Date;
  updatedAt: Date;
  @ApiProperty({ type: PersonSummaryDto }) person: PersonSummaryDto;
}

export class GuardianDetailDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) personId: string;
  @ApiProperty({ type: String, nullable: true }) qualification: string | null;
  @ApiProperty({ type: String, nullable: true }) occupation: string | null;
  @ApiProperty({ type: String, nullable: true }) employer: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) annualIncome?: number | null;
  createdAt: Date;
  updatedAt: Date;
  @ApiProperty({ type: PersonDto }) person: PersonDto;
  /** Children in the caller's campus scope. */
  @ApiProperty({ type: [GuardianChildDto] }) children: GuardianChildDto[];
}

export class GuardianPageDto {
  @ApiProperty({ type: [GuardianDto] }) items: GuardianDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
