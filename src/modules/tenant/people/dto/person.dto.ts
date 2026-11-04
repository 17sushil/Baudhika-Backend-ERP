import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';
import { IsDateOnly, IsOptionalNonNull, Trim } from '../../../../common/decorators/validation.decorators';
import { AddressKind, BloodGroup, ContactKind, Gender } from '../people.enums';

const upper = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

// ---------------------------------------------------------------- contacts

export class ContactInputDto {
  @ApiProperty({ enum: ContactKind, enumName: 'ContactKind', example: ContactKind.PHONE }) @IsEnum(ContactKind) type: ContactKind;
  /** Phone/WhatsApp: 7-15 digits (spaces, dashes removed). Email: a valid address (stored lowercase). */
  @ApiProperty({ example: '9841000000' }) @Trim() @IsString() @Length(3, 254) value: string;
  @ApiPropertyOptional({ default: false, description: 'Preferred contact of this type; the previous primary is demoted' })
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class UpdateContactDto {
  @ApiPropertyOptional({ example: '9841000001' }) @IsOptionalNonNull() @Trim() @IsString() @Length(3, 254) value?: string;
  @ApiPropertyOptional() @IsOptionalNonNull() @IsBoolean() isPrimary?: boolean;
}

// ---------------------------------------------------------------- addresses

export class AddressInputDto {
  @ApiProperty({ enum: AddressKind, enumName: 'AddressKind', example: AddressKind.CURRENT }) @IsEnum(AddressKind) type: AddressKind;
  @ApiPropertyOptional({ example: 'Baneshwor-10, Tole 3' }) @IsOptional() @Trim() @IsString() @MaxLength(200) line1?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(200) line2?: string | null;
  @ApiPropertyOptional({ example: '10' }) @IsOptional() @Trim() @IsString() @MaxLength(20) ward?: string | null;
  @ApiPropertyOptional({ example: 'Kathmandu Metropolitan City' }) @IsOptional() @Trim() @IsString() @MaxLength(100) municipality?: string | null;
  @ApiPropertyOptional({ example: 'Kathmandu' }) @IsOptional() @Trim() @IsString() @MaxLength(100) district?: string | null;
  @ApiPropertyOptional({ example: 'Bagmati' }) @IsOptional() @Trim() @IsString() @MaxLength(100) province?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(20) postalCode?: string | null;
  @ApiPropertyOptional({ example: 'NP', default: 'NP', description: 'ISO 3166-1 alpha-2' })
  @IsOptional() @upper() @Matches(/^[A-Z]{2}$/, { message: 'country must be a 2-letter ISO code' }) country?: string;
  @ApiPropertyOptional({ example: 27.7172 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-90) @Max(90) latitude?: number | null;
  @ApiPropertyOptional({ example: 85.324 }) @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-180) @Max(180) longitude?: number | null;
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ enum: AddressKind, enumName: 'AddressKind' }) @IsOptionalNonNull() @IsEnum(AddressKind) type?: AddressKind;
  @IsOptional() @Trim() @IsString() @MaxLength(200) line1?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(200) line2?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(20) ward?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) municipality?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) district?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) province?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(20) postalCode?: string | null;
  @ApiPropertyOptional({ example: 'NP' })
  @IsOptionalNonNull() @upper() @Matches(/^[A-Z]{2}$/, { message: 'country must be a 2-letter ISO code' }) country?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 6 }) @Min(-180) @Max(180) longitude?: number | null;
}

// ---------------------------------------------------------------- persons

export class PersonInputDto {
  @ApiProperty({ example: 'Ram' }) @Trim() @IsString() @Length(1, 100) firstName: string;
  @IsOptional() @Trim() @IsString() @MaxLength(100) middleName?: string | null;
  @ApiPropertyOptional({ example: 'Sharma' }) @IsOptional() @Trim() @IsString() @MaxLength(100) lastName?: string | null;
  @ApiPropertyOptional({ enum: Gender, enumName: 'Gender' }) @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @ApiPropertyOptional({ example: '2015-04-14', description: 'Not in the future' }) @IsOptional() @IsDateOnly() dob?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) birthPlace?: string | null;
  @ApiPropertyOptional({ enum: BloodGroup, enumName: 'BloodGroup' }) @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup | null;
  @ApiPropertyOptional({ example: 'Nepali' }) @IsOptional() @Trim() @IsString() @MaxLength(50) nationality?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) nationalId?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) motherTongue?: string | null;
  /** SENSITIVE: needs person.sensitive.read to set. */
  @IsOptional() @Trim() @IsString() @MaxLength(50) religion?: string | null;
  /** SENSITIVE: needs person.sensitive.read to set. */
  @IsOptional() @Trim() @IsString() @MaxLength(100) ethnicity?: string | null;
  @ApiPropertyOptional({ type: [ContactInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ContactInputDto) contacts?: ContactInputDto[];
  @ApiPropertyOptional({ type: [AddressInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => AddressInputDto) addresses?: AddressInputDto[];
}

/** Contacts and addresses have their own endpoints. */
export class UpdatePersonDto {
  @ApiPropertyOptional() @IsOptionalNonNull() @Trim() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @Trim() @IsString() @MaxLength(100) middleName?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) lastName?: string | null;
  @ApiPropertyOptional({ enum: Gender, enumName: 'Gender', nullable: true }) @IsOptional() @IsEnum(Gender) gender?: Gender | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateOnly() dob?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) birthPlace?: string | null;
  @ApiPropertyOptional({ enum: BloodGroup, enumName: 'BloodGroup', nullable: true }) @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) nationality?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) nationalId?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) motherTongue?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(50) religion?: string | null;
  @IsOptional() @Trim() @IsString() @MaxLength(100) ethnicity?: string | null;
}

/** Either reuse an existing person (personId) or create one (person). Exactly one is required. */
export class PersonRefDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Reuse an existing person (e.g. found via /persons/lookup)' })
  @IsOptional() @IsUUID() personId?: string;
  @ApiPropertyOptional({ type: PersonInputDto, description: 'Create a new person' })
  @IsOptional() @ValidateNested() @Type(() => PersonInputDto) person?: PersonInputDto;
}

export class ListPersonsDto extends PaginationQueryDto {
  /** Name contains (case-insensitive). */
  @IsOptional() @Trim() @IsString() @MaxLength(100) search?: string;
}

export class LookupPersonsDto {
  @ApiProperty({ example: '9841000000', description: 'Exact phone/WhatsApp number or email of a contact' })
  @Trim() @IsString() @Length(3, 254) contact: string;
}

export class LinkUserDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'users.id, or null to unlink' })
  @IsOptional() @IsUUID() userId: string | null;
}
