import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';
import { normalizePhone, PHONE_RE } from '../../access/identifier.util';
import { CampusKind } from '../organization.enums';

const upper = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));
const phone = () => Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value));
export const CAMPUS_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{0,19}$/;

export class CreateCampusDto {
  @ApiProperty({ example: 'MAIN', pattern: CAMPUS_CODE_RE.source, description: 'Short unique code, stored uppercase' })
  @upper() @IsString() @Matches(CAMPUS_CODE_RE, { message: 'code must be 1-20 letters, digits, - or _' }) code: string;
  @ApiProperty({ example: 'Sunrise Main School' }) @Trim() @IsString() @Length(2, 150) name: string;
  @ApiPropertyOptional({ enum: CampusKind, enumName: 'CampusKind', default: CampusKind.SCHOOL })
  @IsOptional() @IsEnum(CampusKind) kind?: CampusKind;
  @ApiPropertyOptional({ example: '340010001', description: 'Government EMIS code for official reports' })
  @IsOptional() @Trim() @IsString() @MaxLength(50) emisSchoolCode?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(500) address?: string | null;
  @ApiPropertyOptional({ example: '014412345', pattern: PHONE_RE.source })
  @IsOptional() @phone() @Matches(PHONE_RE, { message: 'phone must be 7-15 digits, optional leading +' }) phone?: string | null;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCampusDto {
  @ApiPropertyOptional({ example: 'MAIN', pattern: CAMPUS_CODE_RE.source })
  @IsOptionalNonNull() @upper() @IsString() @Matches(CAMPUS_CODE_RE, { message: 'code must be 1-20 letters, digits, - or _' }) code?: string;
  @ApiPropertyOptional() @IsOptionalNonNull() @Trim() @IsString() @Length(2, 150) name?: string;
  @ApiPropertyOptional({ enum: CampusKind, enumName: 'CampusKind' }) @IsOptionalNonNull() @IsEnum(CampusKind) kind?: CampusKind;
  @IsOptional() @Trim() @IsString() @MaxLength(50) emisSchoolCode?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(500) address?: string | null;
  @ApiPropertyOptional({ pattern: PHONE_RE.source })
  @IsOptional() @phone() @Matches(PHONE_RE, { message: 'phone must be 7-15 digits, optional leading +' }) phone?: string | null;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() isActive?: boolean;
}

const bool = () => Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));

export class ListCampusesDto {
  @ApiPropertyOptional() @IsOptional() @bool() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ enum: CampusKind, enumName: 'CampusKind' }) @IsOptional() @IsEnum(CampusKind) kind?: CampusKind;
}
