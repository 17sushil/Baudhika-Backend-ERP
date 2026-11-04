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
import { Person } from '../../people/entities/person.tenant.entity';

/** Guardian profile; one per person however many children they have. */
@Entity('guardians')
@Index('uq_guardians_person_live', { synchronize: false })
@Check('chk_guardians_annual_income', `annual_income IS NULL OR annual_income >= 0`)
export class Guardian {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'person_id', type: 'uuid' }) personId: string;
  @Column({ type: 'text', nullable: true }) qualification: string | null;
  @Column({ type: 'text', nullable: true }) occupation: string | null;
  @Column({ type: 'text', nullable: true }) employer: string | null;
  /** SENSITIVE (guardian.sensitive.read). numeric comes back from pg as a string. */
  @Column({ name: 'annual_income', type: 'numeric', precision: 14, scale: 2, nullable: true }) annualIncome: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => Person)
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'fk_guardians_person' })
  person?: Person;
}
