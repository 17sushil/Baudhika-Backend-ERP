import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '../access.enums';
import type { UserRole } from './user-role.tenant.entity';

/** Login account only. Who the person is lives in persons (persons.user_id). */
@Entity('users')
@Index('uq_users_username_live', { synchronize: false })
@Index('uq_users_email_live', { synchronize: false })
@Index('uq_users_phone_live', { synchronize: false })
@Check('chk_users_identifier', `username IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL`)
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'citext', nullable: true }) username: string | null;
  @Column({ type: 'citext', nullable: true }) email: string | null;
  @Column({ type: 'text', nullable: true }) phone: string | null;
  /** Never selected by default and never returned by any API. */
  @Column({ name: 'password_hash', type: 'text', select: false }) passwordHash: string;
  @Column({ type: 'enum', enum: UserStatus, enumName: 'user_status', default: UserStatus.ACTIVE }) status: UserStatus;
  @Column({ name: 'must_change_password', default: false }) mustChangePassword: boolean;
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true }) emailVerifiedAt: Date | null;
  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true }) phoneVerifiedAt: Date | null;
  @Column({ name: 'mfa_enabled', default: false }) mfaEnabled: boolean;
  @Column({ name: 'failed_login_count', type: 'int', default: 0 }) failedLoginCount: number;
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true }) lockedUntil: Date | null;
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true }) passwordChangedAt: Date | null;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @Column({ type: 'text', default: 'en' }) locale: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;

  @OneToMany('UserRole', (ur: UserRole) => ur.user) roles?: UserRole[];
}
