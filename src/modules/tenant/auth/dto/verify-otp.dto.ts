import { IsUUID, Matches } from 'class-validator';

export class TenantVerifyOtpDto {
  @IsUUID() challengeId: string;
  @Matches(/^\d{6}$/) code: string;
}
