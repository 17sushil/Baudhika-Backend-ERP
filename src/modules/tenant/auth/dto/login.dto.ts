import { IsString, Length, MaxLength } from 'class-validator';

export class TenantLoginDto {
  /** Username, email or phone number. */
  @IsString() @Length(3, 254) identifier: string;
  @IsString() @MaxLength(128) password: string;
}
