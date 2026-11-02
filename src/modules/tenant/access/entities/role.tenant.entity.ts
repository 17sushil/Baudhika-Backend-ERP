import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RolePermission } from './role-permission.tenant.entity';

/** Named bundle of permissions: admin, principal, teacher, hod, parent, ... */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Stable machine name used in code. Never changed for system roles. */
  @Column({ type: 'text', unique: true }) code: string;
  @Column({ type: 'text' }) name: string;
  /** Seeded by the product: cannot be deleted or have its code changed. */
  @Column({ name: 'is_system', default: false }) isSystem: boolean;
  /** Holders of this role must pass an OTP at every login (admin, principal). */
  @Column({ name: 'requires_mfa', default: false }) requiresMfa: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;

  @OneToMany('RolePermission', (rp: RolePermission) => rp.role) permissions?: RolePermission[];
}
