import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ScopeKind } from '../access.enums';
import { Role } from './role.tenant.entity';
import { User } from './user.tenant.entity';

/** Assigns a role to a user, limited to a scope (institution, campus, department, class, section). */
@Entity('user_roles')
@Index('idx_user_roles_user', ['userId'])
@Index('idx_user_roles_role', ['roleId'])
@Index('uq_user_roles_assignment', { synchronize: false })
@Check('chk_user_roles_scope', `(scope_type = 'institution') = (scope_id IS NULL)`)
@Check('chk_user_roles_validity', `valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from`)
export class UserRole {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'role_id', type: 'uuid' }) roleId: string;
  @Column({ name: 'scope_type', type: 'enum', enum: ScopeKind, enumName: 'scope_kind', default: ScopeKind.INSTITUTION })
  scopeType: ScopeKind;
  @Column({ name: 'scope_id', type: 'uuid', nullable: true }) scopeId: string | null;
  @Column({ name: 'valid_from', type: 'date', nullable: true }) validFrom: string | null;
  @Column({ name: 'valid_to', type: 'date', nullable: true }) validTo: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;

  @ManyToOne(() => User, (u) => u.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_user_roles_user' })
  user?: User;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id', foreignKeyConstraintName: 'fk_user_roles_role' })
  role?: Role;
}
