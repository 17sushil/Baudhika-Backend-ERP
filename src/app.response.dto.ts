import { ApiProperty } from '@nestjs/swagger';

export class AppInfoDto {
  @ApiProperty({ example: 'erp-backend' }) service: string;
  @ApiProperty({ example: 'ok' }) status: string;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: 'up' }) database: string;
  /** Process uptime in seconds. */
  @ApiProperty({ example: 120 }) uptime: number;
  @ApiProperty({ example: '2026-11-03T10:00:00.000Z' }) timestamp: string;
}
