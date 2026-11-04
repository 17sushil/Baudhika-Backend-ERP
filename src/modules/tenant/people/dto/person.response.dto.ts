import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressKind, BloodGroup, ContactKind, Gender } from '../people.enums';

export class ContactDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ContactKind, enumName: 'ContactKind' }) type: ContactKind;
  @ApiProperty({ example: '9841000000' }) value: string;
  isPrimary: boolean;
  @ApiProperty({ type: Date, nullable: true }) verifiedAt: Date | null;
}

export class AddressDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: AddressKind, enumName: 'AddressKind' }) type: AddressKind;
  @ApiProperty({ type: String, nullable: true }) line1: string | null;
  @ApiProperty({ type: String, nullable: true }) line2: string | null;
  @ApiProperty({ type: String, nullable: true }) ward: string | null;
  @ApiProperty({ type: String, nullable: true }) municipality: string | null;
  @ApiProperty({ type: String, nullable: true }) district: string | null;
  @ApiProperty({ type: String, nullable: true }) province: string | null;
  @ApiProperty({ type: String, nullable: true }) postalCode: string | null;
  @ApiProperty({ example: 'NP' }) country: string;
  @ApiProperty({ type: Number, nullable: true }) latitude: number | null;
  @ApiProperty({ type: Number, nullable: true }) longitude: number | null;
}

export class PersonProfilesDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) studentId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) guardianId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) staffId: string | null;
}

export class PersonDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  /** Login linked to this person (portal access). */
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) userId: string | null;
  @ApiProperty({ example: 'Ram' }) firstName: string;
  @ApiProperty({ type: String, nullable: true }) middleName: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Sharma' }) lastName: string | null;
  @ApiProperty({ example: 'Ram Sharma' }) displayName: string;
  @ApiProperty({ enum: Gender, enumName: 'Gender', nullable: true }) gender: Gender | null;
  @ApiProperty({ type: String, nullable: true, example: '2015-04-14' }) dob: string | null;
  @ApiProperty({ type: String, nullable: true }) birthPlace: string | null;
  @ApiProperty({ enum: BloodGroup, enumName: 'BloodGroup', nullable: true }) bloodGroup: BloodGroup | null;
  @ApiProperty({ type: String, nullable: true }) nationality: string | null;
  @ApiProperty({ type: String, nullable: true }) nationalId: string | null;
  @ApiProperty({ type: String, nullable: true }) motherTongue: string | null;
  /** Present only for holders of person.sensitive.read. */
  @ApiPropertyOptional({ type: String, nullable: true }) religion?: string | null;
  /** Present only for holders of person.sensitive.read. */
  @ApiPropertyOptional({ type: String, nullable: true }) ethnicity?: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) photoFileId: string | null;
  createdAt: Date;
  updatedAt: Date;
  @ApiPropertyOptional({ type: [ContactDto] }) contacts?: ContactDto[];
  @ApiPropertyOptional({ type: [AddressDto] }) addresses?: AddressDto[];
}

export class PersonDetailDto extends PersonDto {
  @ApiProperty({ type: PersonProfilesDto }) profiles: PersonProfilesDto;
}

export class PersonPageDto {
  @ApiProperty({ type: [PersonDto] }) items: PersonDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class PersonLookupDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Sita Sharma' }) displayName: string;
  @ApiProperty({ enum: Gender, enumName: 'Gender', nullable: true }) gender: Gender | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) studentId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) guardianId: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) staffId: string | null;
}
