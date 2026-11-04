import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Campus } from './campus.tenant.entity';

/** Academic or administrative department. campus_id NULL = whole institution. HODs come from user_roles. */
@Entity('departments')
@Index('idx_departments_campus', ['campusId'])
@Index('uq_departments_name_live', { synchronize: false })
export class Department {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'campus_id', type: 'uuid', nullable: true }) campusId: string | null;
  @Column({ type: 'text', nullable: true }) code: string | null;
  @Column({ type: 'text' }) name: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @ManyToOne(() => Campus)
  @JoinColumn({ name: 'campus_id', foreignKeyConstraintName: 'fk_departments_campus' })
  campus?: Campus | null;
}
