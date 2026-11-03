import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_RE } from '../../../../common/utils/password.util';
import { normalizePhone, PHONE_RE, USERNAME_RE } from '../../access/identifier.util';

export class CreateUserDto {
  @ApiPropertyOptional({ pattern: USERNAME_RE.source, example: 'ram.thapa', description: 'Starts with a letter; case-insensitive unique' })
  @IsOptional() @IsString() @Matches(USERNAME_RE, { message: 'username must start with a letter (3-50 chars: letters, digits, . _ -)' })
  username?: string;

  @ApiPropertyOptional({ example: 'ram@sunrise.edu', description: 'Stored lowercase; unique' })
  @IsOptional() @IsEmail() @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ApiPropertyOptional({ pattern: PHONE_RE.source, example: '9841000000', description: 'Spaces, dashes and brackets are removed; unique' })
  @IsOptional() @IsString() @Matches(PHONE_RE, { message: 'phone must be 7-15 digits, optional leading +' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  phone?: string;

  /** Initial password chosen by the admin and shared with the person (no invitation flow). */
  @ApiProperty({ minLength: 8, maxLength: 128, example: 'Teacher123', description: PASSWORD_POLICY_MESSAGE })
  @IsString() @Matches(PASSWORD_POLICY_RE, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() mustChangePassword?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Always require email OTP (needs email)' }) @IsOptional() @IsBoolean() mfaEnabled?: boolean;
  @IsOptional() @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/) locale?: string;

  /** Role codes granted at institution scope. Needs role.assign. */
  @ApiPropertyOptional({ example: ['teacher'] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @Matches(/^[a-z][a-z0-9_]{1,49}$/, { each: true })
  roles?: string[];
}
