import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@platform.test' }) @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
}