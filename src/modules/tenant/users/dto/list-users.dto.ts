import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { UserStatus } from '../../access/access.enums';

export class ListUsersDto {
  /** Matches username, email or phone (contains, case-insensitive). */
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
