import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../audit.enums';

export class AuditLogDto {
  @ApiProperty({ example: '42' }) id: string;
  @ApiProperty({ example: 'student_guardians' }) tableName: string;
  @ApiProperty({ format: 'uuid' }) recordId: string;
  @ApiProperty({ enum: AuditAction, enumName: 'AuditAction' }) action: AuditAction;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true }) oldData: Record<string, unknown> | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true }) newData: Record<string, unknown> | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) changedBy: string | null;
  changedAt: Date;
  @ApiProperty({ type: String, nullable: true, example: '203.0.113.7' }) ipAddress: string | null;
}

export class AuditLogPageDto {
  @ApiProperty({ type: [AuditLogDto] }) items: AuditLogDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
