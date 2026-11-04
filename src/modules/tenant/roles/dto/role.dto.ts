import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsString, Length, Matches } from 'class-validator';
import { IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';

export const ROLE_CODE_RE = /^[a-z][a-z0-9_]{1,49}$/;
export const PERMISSION_CODE_RE = /^[a-z][a-z0-9_.]{1,99}$/;

export class CreateRoleDto {
  @ApiProperty({ example: 'librarian', pattern: ROLE_CODE_RE.source, description: 'Stable machine name; cannot change later' })
  @Matches(ROLE_CODE_RE, { message: 'code: 2-50 lowercase letters, digits or _, starting with a letter' }) code: string;
  @ApiProperty({ example: 'Librarian' }) @Trim() @IsString() @Length(2, 100) name: string;
  @ApiPropertyOptional({ default: false, description: 'Holders must pass an email OTP at every login' })
  @IsOptionalNonNull() @IsBoolean() requiresMfa?: boolean;
  /** Permission codes from GET /permissions. You can only include permissions you hold yourself. */
  @ApiProperty({ example: ['org.read', 'student.read'], type: [String] })
  @IsArray() @ArrayMaxSize(200) @ArrayUnique() @Matches(PERMISSION_CODE_RE, { each: true }) permissions: string[];
}

/** permissions replaces the whole set. The admin role only accepts a new name. */
export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Head Librarian' }) @IsOptionalNonNull() @Trim() @IsString() @Length(2, 100) name?: string;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() requiresMfa?: boolean;
  @ApiPropertyOptional({ example: ['org.read', 'student.read', 'staff.read'], type: [String] })
  @IsOptionalNonNull() @IsArray() @ArrayMaxSize(200) @ArrayUnique() @Matches(PERMISSION_CODE_RE, { each: true }) permissions?: string[];
}
