import { ApiProperty } from '@nestjs/swagger';

export class OtpChallengeDto {
  /** Send it with the emailed code to verify-otp. */
  @ApiProperty({ format: 'uuid' }) challengeId: string;
  @ApiProperty({ example: 300 }) expiresInSeconds: number;
}
