import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../access/entities/user.tenant.entity';
import { StoredFile } from '../../files/entities/file.tenant.entity';
import { BloodGroup, Gender } from '../people.enums';
import type { PersonAddress } from './person-address.tenant.entity';
import type { PersonContact } from './person-contact.tenant.entity';

export const DISPLAY_NAME_EXPR = `first_name || COALESCE(' ' || middle_name, '') || COALESCE(' ' || last_name, '')`;

/** One row per human. Students, guardians and staff are profiles pointing here; logins link via user_id. */
@Entity('persons')
@Index('uq_persons_user_live', { synchronize: false })
@Index('idx_persons_name', { synchronize: false })
@Index('idx_persons_display_name_trgm', { synchronize: false })
export class Person {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ name: 'first_name', type: 'text' }) firstName: string;
  @Column({ name: 'middle_name', type: 'text', nullable: true }) middleName: string | null;
  @Column({ name: 'last_name', type: 'text', nullable: true }) lastName: string | null;
  @Column({ name: 'display_name', type: 'text', generatedType: 'STORED', asExpression: DISPLAY_NAME_EXPR, insert: false, update: false })
  displayName: string;
  @Column({ type: 'enum', enum: Gender, enumName: 'gender_kind', nullable: true }) gender: Gender | null;
  @Column({ type: 'date', nullable: true }) dob: string | null;
  @Column({ name: 'birth_place', type: 'text', nullable: true }) birthPlace: string | null;
  @Column({ name: 'blood_group', type: 'enum', enum: BloodGroup, enumName: 'blood_group_kind', nullable: true }) bloodGroup: BloodGroup | null;
  @Column({ type: 'text', nullable: true }) nationality: string | null;
  @Column({ name: 'national_id', type: 'text', nullable: true }) nationalId: string | null;
  @Column({ name: 'mother_tongue', type: 'text', nullable: true }) motherTongue: string | null;
  /** SENSITIVE: person.sensitive.read. */
  @Column({ type: 'text', nullable: true }) religion: string | null;
  /** SENSITIVE: person.sensitive.read. */
  @Column({ type: 'text', nullable: true }) ethnicity: string | null;
  @Column({ name: 'photo_file_id', type: 'uuid', nullable: true }) photoFileId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_persons_user' })
  user?: User | null;

  @ManyToOne(() => StoredFile)
  @JoinColumn({ name: 'photo_file_id', foreignKeyConstraintName: 'fk_persons_photo_file' })
  photoFile?: StoredFile | null;

  @OneToMany('PersonContact', (c: PersonContact) => c.person) contacts?: PersonContact[];
  @OneToMany('PersonAddress', (a: PersonAddress) => a.person) addresses?: PersonAddress[];
}
