import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_RE } from '../../../../common/utils/password.util';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 128, example: 'Teacher456', description: PASSWORD_POLICY_MESSAGE })
  @IsString() @Matches(PASSWORD_POLICY_RE, { message: PASSWORD_POLICY_MESSAGE }) password: string;
  /** Defaults to true: the person must pick their own password at next login. */
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() mustChangePassword?: boolean;
}
