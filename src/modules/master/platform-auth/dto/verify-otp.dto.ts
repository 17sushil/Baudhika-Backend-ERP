import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID() challengeId: string;
  @ApiProperty({ example: '123456', description: '6-digit code from the email (dev: server log)' }) @Matches(/^\d{6}$/) code: string;
}