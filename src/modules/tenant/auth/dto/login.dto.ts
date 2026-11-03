import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength } from 'class-validator';

export class TenantLoginDto {
  /** Username, email or phone number. */
  @ApiProperty({ example: 'admin@sunrise.edu', description: 'Username, email or phone number' })
  @IsString() @Length(3, 254) identifier: string;
  @ApiProperty({ example: 'Sunrise-Admin-2026' }) @IsString() @MaxLength(128) password: string;
}
