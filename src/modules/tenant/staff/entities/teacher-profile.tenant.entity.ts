import { Check, Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Staff } from './staff.tenant.entity';

/** Teaching-only details; required for staff_type = teaching. */
@Entity('teacher_profiles')
@Check('chk_teacher_profiles_experience', `experience_years IS NULL OR experience_years >= 0`)
@Check('chk_teacher_profiles_periods', `max_weekly_periods IS NULL OR max_weekly_periods >= 0`)
export class TeacherProfile {
  @PrimaryColumn({ name: 'staff_id', type: 'uuid' }) staffId: string;
  @Column({ name: 'highest_qualification', type: 'text', nullable: true }) highestQualification: string | null;
  @Column({ type: 'text', nullable: true }) specialization: string | null;
  /** numeric comes back from pg as a string. */
  @Column({ name: 'experience_years', type: 'numeric', precision: 4, scale: 1, nullable: true }) experienceYears: string | null;
  @Column({ name: 'max_weekly_periods', type: 'int', nullable: true }) maxWeeklyPeriods: number | null;
  @Column({ name: 'teaching_license_no', type: 'text', nullable: true }) teachingLicenseNo: string | null;

  @OneToOne(() => Staff)
  @JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'fk_teacher_profiles_staff' })
  staff?: Staff;
}
