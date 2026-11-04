import { Check, Column, Entity, PrimaryColumn } from 'typeorm';

/** One code series (admission_no, employee_code). Values are issued only by the next_code() SQL function. */
@Entity('number_sequences')
@Check('chk_number_sequences_padding', `padding BETWEEN 1 AND 12`)
@Check('chk_number_sequences_next_value', `next_value >= 1`)
export class NumberSequence {
  @PrimaryColumn({ type: 'text' }) code: string;
  @Column({ type: 'text', default: '' }) prefix: string;
  @Column({ type: 'int', default: 4 }) padding: number;
  /** bigint comes back from pg as a string. */
  @Column({ name: 'next_value', type: 'bigint', default: 1 }) nextValue: string;
  @Column({ name: 'reset_yearly', default: false }) resetYearly: boolean;
  @Column({ name: 'last_reset_year', type: 'int', nullable: true }) lastResetYear: number | null;
}
