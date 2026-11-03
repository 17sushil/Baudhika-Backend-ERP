import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '../entities/tenant.master.entity';

export class TenantViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'sunrise' }) slug: string;
  @ApiProperty({ example: 'Sunrise School' }) name: string;
  @ApiProperty({ enum: TenantStatus, enumName: 'TenantStatus', example: TenantStatus.ACTIVE }) status: TenantStatus;
  @ApiProperty({ type: String, nullable: true, example: null }) customDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ThemeDto {
  @ApiProperty({ example: '#2563EB' }) primary: string;
  /** Black or white, whichever reads better on primary. */
  @ApiProperty({ example: '#FFFFFF' }) primaryForeground: string;
  @ApiProperty({ example: '#0F172A' }) secondary: string;
  @ApiProperty({ example: '#FFFFFF' }) secondaryForeground: string;
}

/** Public school config. A suspended school returns only slug, status and name. */
export class PublicTenantConfigDto {
  @ApiProperty({ example: 'sunrise' }) slug: string;
  @ApiProperty({ enum: TenantStatus, enumName: 'TenantStatus', example: TenantStatus.ACTIVE }) status: TenantStatus;
  @ApiProperty({ example: 'Sunrise School' }) name: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'SRS' }) shortName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'https://cdn.example.com/logo.png' }) logoUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) faviconUrl?: string | null;
  @ApiPropertyOptional({ example: 'en' }) language?: string;
  @ApiPropertyOptional({ type: ThemeDto }) theme?: ThemeDto;
}
