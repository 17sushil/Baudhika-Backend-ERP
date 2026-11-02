import { IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_RE } from '../../../../common/utils/password.util';

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword: string;
  @IsString() @Matches(PASSWORD_POLICY_RE, { message: PASSWORD_POLICY_MESSAGE }) newPassword: string;
}
