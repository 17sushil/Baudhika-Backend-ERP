import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { Trim } from '../../../../common/decorators/validation.decorators';
import { PersonRefDto } from '../../people/dto/person.dto';

export class GuardianFieldsDto {
  @ApiPropertyOptional({ example: 'Bachelor' }) @IsOptional() @Trim() @IsString() @MaxLength(150) qualification?: string | null;
  @ApiPropertyOptional({ example: 'Engineer' }) @IsOptional() @Trim() @IsString() @MaxLength(150) occupation?: string | null;
  @ApiPropertyOptional({ example: 'Nepal Telecom' }) @IsOptional() @Trim() @IsString() @MaxLength(150) employer?: string | null;
  /** SENSITIVE: needs guardian.sensitive.read to set or see. */
  @ApiPropertyOptional({ example: 850000, minimum: 0 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999_999_999_999.99) annualIncome?: number | null;
}

/** personId (reuse) or person (create) + guardian details. */
export class CreateGuardianDto extends PersonRefDto {
  @ApiPropertyOptional({ example: 'Bachelor' }) @IsOptional() @Trim() @IsString() @MaxLength(150) qualification?: string | null;
  @ApiPropertyOptional({ example: 'Engineer' }) @IsOptional() @Trim() @IsString() @MaxLength(150) occupation?: string | null;
  @ApiPropertyOptional({ example: 'Nepal Telecom' }) @IsOptional() @Trim() @IsString() @MaxLength(150) employer?: string | null;
  /** SENSITIVE: needs guardian.sensitive.read to set or see. */
  @ApiPropertyOptional({ example: 850000, minimum: 0 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999_999_999_999.99) annualIncome?: number | null;
}

export class UpdateGuardianDto extends GuardianFieldsDto {}

export class ListGuardiansDto extends PaginationQueryDto {
  /** Name contains, or exact phone/email. */
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
}
