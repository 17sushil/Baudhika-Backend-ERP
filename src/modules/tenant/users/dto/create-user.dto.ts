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
  @IsOptional() @IsString() @Matches(USERNAME_RE, { message: 'username must start with a letter (3-50 chars: letters, digits, . _ -)' })
  username?: string;

  @IsOptional() @IsEmail() @MaxLength(254)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional() @IsString() @Matches(PHONE_RE, { message: 'phone must be 7-15 digits, optional leading +' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  phone?: string;

  /** Initial password chosen by the admin and shared with the person (no invitation flow). */
  @IsString() @Matches(PASSWORD_POLICY_RE, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
  @IsOptional() @IsBoolean() mfaEnabled?: boolean;
  @IsOptional() @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/) locale?: string;

  /** Role codes granted at institution scope. Needs role.assign. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @Matches(/^[a-z][a-z0-9_]{1,49}$/, { each: true })
  roles?: string[];
}
