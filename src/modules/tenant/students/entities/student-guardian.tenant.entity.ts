import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Guardian } from '../../guardians/entities/guardian.tenant.entity';
import { GuardianRelation } from '../students.enums';
import { Student } from './student.tenant.entity';

/** Student <-> guardian link with what the guardian may do. At most one primary guardian per student. */
@Entity('student_guardians')
@Index('uq_student_guardians_primary', { synchronize: false })
@Index('idx_student_guardians_guardian', ['guardianId'])
@Check('chk_student_guardians_validity', `valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from`)
export class StudentGuardian {
  @PrimaryColumn({ name: 'student_id', type: 'uuid' }) studentId: string;
  @PrimaryColumn({ name: 'guardian_id', type: 'uuid' }) guardianId: string;
  @Column({ type: 'enum', enum: GuardianRelation, enumName: 'guardian_relation' }) relation: GuardianRelation;
  @Column({ name: 'is_primary', default: false }) isPrimary: boolean;
  @Column({ name: 'is_emergency_contact', default: false }) isEmergencyContact: boolean;
  @Column({ name: 'lives_with_student', default: true }) livesWithStudent: boolean;
  @Column({ name: 'can_pickup', default: true }) canPickup: boolean;
  @Column({ name: 'can_view_results', default: true }) canViewResults: boolean;
  @Column({ name: 'can_pay_fees', default: true }) canPayFees: boolean;
  @Column({ name: 'has_custody', default: true }) hasCustody: boolean;
  @Column({ name: 'valid_from', type: 'date', nullable: true }) validFrom: string | null;
  @Column({ name: 'valid_to', type: 'date', nullable: true }) validTo: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_student_guardians_student' })
  student?: Student;

  @ManyToOne(() => Guardian)
  @JoinColumn({ name: 'guardian_id', foreignKeyConstraintName: 'fk_student_guardians_guardian' })
  guardian?: Guardian;
}
