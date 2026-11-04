import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StudentStatus } from '../students.enums';
import { Student } from './student.tenant.entity';

/** Append-only timeline of status changes (a trigger rejects UPDATE/DELETE). */
@Entity('student_status_history')
@Index('idx_student_status_history_student', ['studentId'])
export class StudentStatusHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'student_id', type: 'uuid' }) studentId: string;
  @Column({ name: 'from_status', type: 'enum', enum: StudentStatus, enumName: 'student_status', nullable: true }) fromStatus: StudentStatus | null;
  @Column({ name: 'to_status', type: 'enum', enum: StudentStatus, enumName: 'student_status' }) toStatus: StudentStatus;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ name: 'changed_by', type: 'uuid', nullable: true }) changedBy: string | null;
  @Column({ name: 'changed_at', type: 'timestamptz', default: () => 'now()' }) changedAt: Date;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_student_status_history_student' })
  student?: Student;
}
