import { ApiProperty } from '@nestjs/swagger';
import { TokenPairDto } from '../../../../common/dto/token-pair.dto';
import { ScopeKind } from '../../access/access.enums';

export class LoginAuthenticatedDto extends TokenPairDto {
  @ApiProperty({ enum: ['authenticated'], example: 'authenticated' }) status: 'authenticated';
  /** When true, only /auth/me, /auth/change-password and /auth/logout work until the password is changed. */
  mustChangePassword: boolean;
}

export class LoginOtpRequiredDto {
  @ApiProperty({ enum: ['otp_required'], example: 'otp_required' }) status: 'otp_required';
  @ApiProperty({ format: 'uuid' }) challengeId: string;
  @ApiProperty({ enum: ['email'], example: 'email' }) channel: 'email';
  /** Masked address the code was sent to. */
  @ApiProperty({ example: 'a***@sunrise.edu' }) destination: string;
  @ApiProperty({ example: 300 }) expiresInSeconds: number;
}

export class RoleGrantDto {
  /** Use with DELETE /users/:id/roles/:assignmentId. */
  @ApiProperty({ format: 'uuid' }) assignmentId: string;
  @ApiProperty({ example: 'principal' }) code: string;
  @ApiProperty({ example: 'Administrator' }) name: string;
  @ApiProperty({ enum: ScopeKind, enumName: 'ScopeKind', example: ScopeKind.INSTITUTION }) scopeType: ScopeKind;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, example: null }) scopeId: string | null;
  @ApiProperty({ type: String, nullable: true, example: null }) validFrom: string | null;
  @ApiProperty({ type: String, nullable: true, example: null }) validTo: string | null;
}

export class MePersonDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Sita Sharma' }) displayName: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) photoFileId: string | null;
}

export class MeTenantDto {
  @ApiProperty({ example: 'sunrise' }) slug: string;
  @ApiProperty({ example: 'Sunrise School' }) name: string;
}

export class MeDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, nullable: true, example: null }) username: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'admin@sunrise.edu' }) email: string | null;
  @ApiProperty({ type: String, nullable: true, example: null }) phone: string | null;
  @ApiProperty({ example: 'en' }) locale: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  @ApiProperty({ type: Date, nullable: true }) lastLoginAt: Date | null;
  @ApiProperty({ type: [RoleGrantDto] }) roles: RoleGrantDto[];
  /** Permission codes granted school-wide; use them to show/hide UI. */
  @ApiProperty({ type: [String], example: ['user.read', 'user.create', 'user.update'] }) permissions: string[];
  @ApiProperty({ type: MeTenantDto }) tenant: MeTenantDto;
  /** The person this login belongs to (null until linked via PUT /persons/:id/user). */
  @ApiProperty({ type: MePersonDto, nullable: true }) person: MePersonDto | null;
}
