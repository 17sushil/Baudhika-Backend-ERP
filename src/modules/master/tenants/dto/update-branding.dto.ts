import { IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';

const HEX = /^#[0-9a-fA-F]{6}$/;
const URL_OPTS = { protocols: ['https'], require_protocol: true };

export class UpdateBrandingDto {
  @IsString() @Length(2, 100) displayName: string;
  @IsOptional() @IsString() @Length(1, 30) shortName?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsUrl(URL_OPTS) @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsUrl(URL_OPTS) @MaxLength(500) faviconUrl?: string;
  @IsOptional() @Matches(HEX) primaryColor?: string;
  @IsOptional() @Matches(HEX) secondaryColor?: string;
  @IsOptional() @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/) language?: string;
}