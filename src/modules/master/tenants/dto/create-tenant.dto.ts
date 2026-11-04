import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Sunrise School' }) @IsString() @Length(2, 100) name: string;
  @ApiProperty({
    example: 'sunrise',
    description: 'Lowercase letters, digits, hyphens; no leading/trailing/double hyphen; not reserved. Becomes <slug>.BASE_DOMAIN and x-tenant-id.',
  })
  @IsString() @Length(3, 30) slug: string;

  /** First account of the school: its principal (top role). Must change the password at first login; OTP goes to this email. */
  @ApiProperty({ example: 'principal@sunrise.edu' }) @IsEmail() @MaxLength(254) principalEmail: string;
  @ApiProperty({ example: 'Sunrise-Principal-2026' }) @IsString() @Length(12, 128) principalPassword: string;
}
