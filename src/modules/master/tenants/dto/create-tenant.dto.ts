import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @IsString() @Length(2, 100) name: string;
  @IsString() @Length(3, 30) slug: string;

  /** First school administrator. Must change the password at first login; OTP goes to this email. */
  @IsEmail() @MaxLength(254) adminEmail: string;
  @IsString() @Length(12, 128) adminPassword: string;
}
