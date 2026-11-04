import { ApiProperty } from '@nestjs/swagger';
import { CampusKind } from '../organization.enums';

export class CampusDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'MAIN' }) code: string;
  @ApiProperty({ example: 'Sunrise Main School' }) name: string;
  @ApiProperty({ enum: CampusKind, enumName: 'CampusKind' }) kind: CampusKind;
  @ApiProperty({ type: String, nullable: true }) emisSchoolCode: string | null;
  @ApiProperty({ type: String, nullable: true }) address: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CampusRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'MAIN' }) code: string;
  @ApiProperty({ example: 'Sunrise Main School' }) name: string;
}

export class DepartmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) campusId: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'SCI' }) code: string | null;
  @ApiProperty({ example: 'Science' }) name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class DesignationDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Teacher' }) name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NumberSequenceDto {
  @ApiProperty({ example: 'admission_no' }) code: string;
  @ApiProperty({ example: 'ADM-' }) prefix: string;
  @ApiProperty({ example: 5 }) padding: number;
  @ApiProperty({ example: 31 }) nextValue: number;
  resetYearly: boolean;
  @ApiProperty({ type: Number, nullable: true, example: 2026 }) lastResetYear: number | null;
  /** The code the next record will get (not reserved). */
  @ApiProperty({ example: 'ADM-2026-00031' }) preview: string;
}
