import { IsString, MaxLength } from 'class-validator';

export class TenantRefreshDto {
  @IsString() @MaxLength(200) refreshToken: string;
}
