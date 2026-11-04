import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ContactKind } from '../people.enums';
import { Person } from './person.tenant.entity';

/** Phone, email or WhatsApp of a person. Not unique: families share numbers. One live primary per type. */
@Entity('person_contacts')
@Index('idx_person_contacts_person', ['personId'])
@Index('idx_person_contacts_value', ['value'])
@Index('uq_person_contacts_primary', { synchronize: false })
export class PersonContact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'person_id', type: 'uuid' }) personId: string;
  @Column({ type: 'enum', enum: ContactKind, enumName: 'contact_kind' }) type: ContactKind;
  @Column({ type: 'text' }) value: string;
  @Column({ name: 'is_primary', default: false }) isPrimary: boolean;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => Person, (p) => p.contacts)
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'fk_person_contacts_person' })
  person?: Person;
}
