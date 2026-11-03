import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_RE } from '../../../../common/utils/password.util';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Initial-Admin-Pass1' }) @IsString() @MaxLength(128) currentPassword: string;
  @ApiProperty({ minLength: 8, maxLength: 128, example: 'NewAdminPass99', description: PASSWORD_POLICY_MESSAGE })
  @IsString() @Matches(PASSWORD_POLICY_RE, { message: PASSWORD_POLICY_MESSAGE }) newPassword: string;
}
