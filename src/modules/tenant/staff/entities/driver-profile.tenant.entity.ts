import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Staff } from './staff.tenant.entity';

/** Driver-only details; required for staff_type = driver. Expiry dates drive renewal reminders. */
@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryColumn({ name: 'staff_id', type: 'uuid' }) staffId: string;
  @Column({ name: 'license_no', type: 'text' }) licenseNo: string;
  @Column({ name: 'license_class', type: 'text', nullable: true }) licenseClass: string | null;
  @Column({ name: 'license_expiry', type: 'date' }) licenseExpiry: string;
  @Column({ name: 'medical_fitness_expiry', type: 'date', nullable: true }) medicalFitnessExpiry: string | null;
  @Column({ name: 'police_verification_date', type: 'date', nullable: true }) policeVerificationDate: string | null;

  @OneToOne(() => Staff)
  @JoinColumn({ name: 'staff_id', foreignKeyConstraintName: 'fk_driver_profiles_staff' })
  staff?: Staff;
}
