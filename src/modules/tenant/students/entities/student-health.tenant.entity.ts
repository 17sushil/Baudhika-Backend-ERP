import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Student } from './student.tenant.entity';

/** SENSITIVE medical record, one per student. Reads need student.health.read and are audit-logged. */
@Entity('student_health')
export class StudentHealth {
  @PrimaryColumn({ name: 'student_id', type: 'uuid' }) studentId: string;
  @Column({ type: 'text', nullable: true }) allergies: string | null;
  @Column({ name: 'medical_conditions', type: 'text', nullable: true }) medicalConditions: string | null;
  @Column({ type: 'text', nullable: true }) medications: string | null;
  @Column({ name: 'disability_type', type: 'text', nullable: true }) disabilityType: string | null;
  @Column({ name: 'disability_notes', type: 'text', nullable: true }) disabilityNotes: string | null;
  @Column({ name: 'doctor_name', type: 'text', nullable: true }) doctorName: string | null;
  @Column({ name: 'doctor_phone', type: 'text', nullable: true }) doctorPhone: string | null;
  @Column({ name: 'insurance_no', type: 'text', nullable: true }) insuranceNo: string | null;
  @Column({ name: 'emergency_instructions', type: 'text', nullable: true }) emergencyInstructions: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;

  @OneToOne(() => Student)
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_student_health_student' })
  student?: Student;
}
