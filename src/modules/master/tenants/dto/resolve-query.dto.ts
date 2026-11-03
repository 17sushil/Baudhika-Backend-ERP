import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveQueryDto {
  @ApiProperty({ example: 'sunrise.localhost', description: 'Browser host, with or without port' })
  @IsString() @MinLength(3) @MaxLength(253) host: string;
}