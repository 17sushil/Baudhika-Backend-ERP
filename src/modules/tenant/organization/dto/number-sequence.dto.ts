import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { IsOptionalNonNull } from '../../../../common/decorators/validation.decorators';

/** next_value is deliberately not editable: moving it down would hand out duplicate numbers. */
export class UpdateNumberSequenceDto {
  @ApiPropertyOptional({ example: 'ADM-', pattern: '^[A-Za-z0-9_./-]{0,20}$' })
  @IsOptionalNonNull() @IsString() @Matches(/^[A-Za-z0-9_./-]{0,20}$/, { message: 'prefix: up to 20 letters, digits, _ . / -' })
  prefix?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 12, example: 5 }) @IsOptionalNonNull() @IsInt() @Min(1) @Max(12) padding?: number;
  @ApiPropertyOptional({ description: 'Restart at 1 every calendar year and include the year (ADM-2026-00031)' })
  @IsOptionalNonNull() @IsBoolean() resetYearly?: boolean;
}
