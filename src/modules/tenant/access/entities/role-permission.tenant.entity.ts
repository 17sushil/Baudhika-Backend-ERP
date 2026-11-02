import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission.tenant.entity';
import { Role } from './role.tenant.entity';

@Entity('role_permissions')
@Index('idx_role_permissions_permission', ['permissionId'])
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' }) roleId: string;
  @PrimaryColumn({ name: 'permission_id', type: 'uuid' }) permissionId: string;

  @ManyToOne(() => Role, (r) => r.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id', foreignKeyConstraintName: 'fk_role_permissions_role' })
  role?: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id', foreignKeyConstraintName: 'fk_role_permissions_permission' })
  permission?: Permission;
}
