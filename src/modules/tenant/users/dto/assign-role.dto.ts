import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { IsDateOnly } from '../../../../common/decorators/validation.decorators';
import { ScopeKind } from '../../access/access.enums';

export class AssignRoleDto {
  @ApiProperty({ example: 'teacher', description: 'Role code' }) @Matches(/^[a-z][a-z0-9_]{1,49}$/) role: string;
  @ApiPropertyOptional({
    enum: ScopeKind,
    enumName: 'ScopeKind',
    default: ScopeKind.INSTITUTION,
    description: 'institution = whole school; campus = one branch (branch admin); department = e.g. HOD. class/section come later.',
  })
  @IsOptional() @IsEnum(ScopeKind) scopeType?: ScopeKind;
  @ApiPropertyOptional({ format: 'uuid', description: 'Campus or department id; omit for institution' })
  @IsOptional() @IsUUID() scopeId?: string;
  @ApiPropertyOptional({ example: '2026-04-01' }) @IsOptional() @IsDateOnly() validFrom?: string;
  @ApiPropertyOptional({ example: '2027-03-31', description: 'Temporary charge: access ends after this day' })
  @IsOptional() @IsDateOnly() validTo?: string;
}
