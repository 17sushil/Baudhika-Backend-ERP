import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AddressKind } from '../people.enums';
import { Person } from './person.tenant.entity';

@Entity('person_addresses')
@Index('idx_person_addresses_person', ['personId'])
@Check('chk_person_addresses_lat', `latitude IS NULL OR latitude BETWEEN -90 AND 90`)
@Check('chk_person_addresses_lng', `longitude IS NULL OR longitude BETWEEN -180 AND 180`)
export class PersonAddress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'person_id', type: 'uuid' }) personId: string;
  @Column({ type: 'enum', enum: AddressKind, enumName: 'address_kind' }) type: AddressKind;
  @Column({ type: 'text', nullable: true }) line1: string | null;
  @Column({ type: 'text', nullable: true }) line2: string | null;
  @Column({ type: 'text', nullable: true }) ward: string | null;
  @Column({ type: 'text', nullable: true }) municipality: string | null;
  @Column({ type: 'text', nullable: true }) district: string | null;
  @Column({ type: 'text', nullable: true }) province: string | null;
  @Column({ name: 'postal_code', type: 'text', nullable: true }) postalCode: string | null;
  @Column({ type: 'text', default: 'NP' }) country: string;
  /** numeric comes back from pg as a string. */
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true }) latitude: string | null;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true }) longitude: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => Person, (p) => p.addresses)
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'fk_person_addresses_person' })
  person?: Person;
}
