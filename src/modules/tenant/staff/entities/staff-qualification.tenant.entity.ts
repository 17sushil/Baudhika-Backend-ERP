import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Staff } from './staff.tenant.entity';

/** One row per degree or certificate. */
@Entity('staff_qualifications')
@Index('idx_staff_qualifications_staff', ['staffId'])
@Check('chk_staff_qualifications_year', `passed_year IS NULL OR passed_year BETWEEN 1900 AND 2200`)
export class StaffQualification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'staff_id', type: 'uuid' }) staffId: string;
  @Column({ type: 'text' }) degree: string;
  @Column({ type: 'text', nullable: true }) institution: string | null;
  @Column({ name: 'passed_year', type: 'int', nullable: true }) passedYear: number | null;
  @Column({ type: 'text', nullable: true }) grade: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'fk_staff_qualifications_staff' })
  staff?: Staff;
}
