import { IsEnum } from 'class-validator';
import { UserStatus } from '../../access/access.enums';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus) status: UserStatus;
}
