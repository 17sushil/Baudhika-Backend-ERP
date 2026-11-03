import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../access/access.enums';
import { RoleGrantDto } from '../../auth/dto/auth.response.dto';

export class UserViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, nullable: true, example: 'ram.thapa' }) username: string | null;
  @ApiProperty({ type: String, nullable: true, example: null }) email: string | null;
  @ApiProperty({ type: String, nullable: true, example: '9841000000' }) phone: string | null;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', example: UserStatus.ACTIVE }) status: UserStatus;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  @ApiProperty({ example: 'en' }) locale: string;
  /** Set after too many wrong passwords. */
  @ApiProperty({ type: Date, nullable: true, example: null }) lockedUntil: Date | null;
  @ApiProperty({ type: Date, nullable: true, example: null }) lastLoginAt: Date | null;
  createdAt: Date;
  @ApiProperty({ type: [RoleGrantDto] }) roles: RoleGrantDto[];
}

export class UserListDto {
  @ApiProperty({ type: [UserViewDto] }) items: UserViewDto[];
  @ApiProperty({ example: 1 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
}
