import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';

const bool = () => Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));

export class CreateDepartmentDto {
  /** Campus this department belongs to; omit/null = whole institution. */
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() campusId?: string | null;
  @ApiPropertyOptional({ example: 'SCI' }) @IsOptional() @Trim() @IsString() @MaxLength(20) code?: string | null;
  @ApiProperty({ example: 'Science' }) @Trim() @IsString() @Length(2, 150) name: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() campusId?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(20) code?: string | null;
  @ApiPropertyOptional() @IsOptionalNonNull() @Trim() @IsString() @Length(2, 150) name?: string;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() isActive?: boolean;
}

export class ListDepartmentsDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() campusId?: string;
  @ApiPropertyOptional() @IsOptional() @bool() @IsBoolean() isActive?: boolean;
}

export class CreateDesignationDto {
  @ApiProperty({ example: 'Senior Teacher' }) @Trim() @IsString() @Length(2, 100) name: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDesignationDto {
  @ApiPropertyOptional() @IsOptionalNonNull() @Trim() @IsString() @Length(2, 100) name?: string;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() isActive?: boolean;
}

export class ListDesignationsDto {
  @ApiPropertyOptional() @IsOptional() @bool() @IsBoolean() isActive?: boolean;
}
