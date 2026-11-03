import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatus } from '../../access/access.enums';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', example: UserStatus.SUSPENDED })
  @IsEnum(UserStatus) status: UserStatus;
}
