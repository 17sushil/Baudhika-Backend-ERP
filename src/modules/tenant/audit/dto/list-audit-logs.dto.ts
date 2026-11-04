import { IsEnum, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { AuditAction } from '../audit.enums';

export class ListAuditLogsDto extends PaginationQueryDto {
  /** e.g. students, student_guardians, staff */
  @IsOptional() @Matches(/^[a-z_]{1,63}$/) tableName?: string;
  @IsOptional() @IsUUID() recordId?: string;
  /** users.id of the actor */
  @IsOptional() @IsUUID() changedBy?: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  /** Inclusive lower bound (ISO date or timestamp). */
  @IsOptional() @IsISO8601() from?: string;
  /** Exclusive upper bound (ISO date or timestamp). */
  @IsOptional() @IsISO8601() to?: string;
}
