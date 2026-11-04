import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class KpiQueryDto {
  /** Narrow to one campus (must be inside your scope). Omit for everything you can see. */
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() campusId?: string;
}

export class CampusCountDto {
  /** null = records without a campus (institution level). */
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) campusId: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'MAIN' }) code: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Sunrise Main' }) name: string | null;
  @ApiProperty({ example: 412, description: 'Enrolled students / current staff on this campus' }) current: number;
  @ApiProperty({ example: 530, description: 'All records on this campus (incl. alumni / departed)' }) total: number;
}

export class StudentKpisDto {
  /** Students with status active: the headline "total students". */
  @ApiProperty({ example: 812 }) enrolled: number;
  @ApiProperty({ example: 37 }) applicants: number;
  /** Every live student record, any status (incl. alumni, transferred out, dropped). */
  @ApiProperty({ example: 1104 }) total: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, example: { applicant: 37, active: 812, alumni: 210, transferred_out: 30, dropped: 9, suspended: 6 } })
  byStatus: Record<string, number>;
  /** Enrolled students by gender (government reports). */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, example: { male: 410, female: 398, other: 1, unknown: 3 } })
  byGender: Record<string, number>;
  @ApiProperty({ example: 18 }) admissionsThisMonth: number;
  @ApiProperty({ example: 140 }) admissionsThisYear: number;
  @ApiProperty({ type: [CampusCountDto] }) byCampus: CampusCountDto[];
}

export class StaffKpisDto {
  /** active + on_leave: the headline "total staff". */
  @ApiProperty({ example: 64 }) current: number;
  @ApiProperty({ example: 61 }) active: number;
  @ApiProperty({ example: 3 }) onLeave: number;
  /** Every live staff record, incl. resigned / terminated / retired. */
  @ApiProperty({ example: 80 }) total: number;
  /** Current staff by type. */
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, example: { teaching: 42, non_teaching: 8, admin: 5, driver: 6, support: 3 } })
  byType: Record<string, number>;
  @ApiProperty({ type: [CampusCountDto] }) byCampus: CampusCountDto[];
}

export class KpisDto {
  /** institution = whole school; campus = limited to the caller's campuses (or ?campusId). */
  @ApiProperty({ enum: ['institution', 'campus'] }) scope: 'institution' | 'campus';
  @ApiProperty({ type: [String], format: 'uuid', nullable: true, description: 'Campuses counted when scope = campus' }) campusIds: string[] | null;
  generatedAt: Date;
  /** Present only with student.read. */
  @ApiPropertyOptional({ type: StudentKpisDto }) students?: StudentKpisDto;
  /** Present only with staff.read. */
  @ApiPropertyOptional({ type: StaffKpisDto }) staff?: StaffKpisDto;
}
