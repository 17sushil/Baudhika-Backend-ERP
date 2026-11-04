import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CampusKind } from '../organization.enums';

/** A physical branch (school or college). Even a single-branch tenant keeps one row. */
@Entity('campuses')
@Index('uq_campuses_code_live', { synchronize: false })
export class Campus {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text' }) code: string;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'enum', enum: CampusKind, enumName: 'campus_kind', default: CampusKind.SCHOOL }) kind: CampusKind;
  @Column({ name: 'emis_school_code', type: 'text', nullable: true }) emisSchoolCode: string | null;
  @Column({ type: 'text', nullable: true }) address: string | null;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;
}
