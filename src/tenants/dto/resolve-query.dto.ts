import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveQueryDto {
  @IsString() @MinLength(3) @MaxLength(253) host: string;
}