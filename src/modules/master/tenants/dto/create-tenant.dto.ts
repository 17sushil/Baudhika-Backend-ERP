import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Sunrise School' }) @IsString() @Length(2, 100) name: string;
  @ApiProperty({
    example: 'sunrise',
    description: 'Lowercase letters, digits, hyphens; no leading/trailing/double hyphen; not reserved. Becomes <slug>.BASE_DOMAIN and x-tenant-id.',
  })
  @IsString() @Length(3, 30) slug: string;

  /** First school administrator. Must change the password at first login; OTP goes to this email. */
  @ApiProperty({ example: 'admin@sunrise.edu' }) @IsEmail() @MaxLength(254) adminEmail: string;
  @ApiProperty({ example: 'Sunrise-Admin-2026' }) @IsString() @Length(12, 128) adminPassword: string;
}
