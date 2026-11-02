import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TenantStatus {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  FAILED = 'failed',
}

@Entity('tenants')
@Check('chk_tenants_status', `status IN ('provisioning', 'active', 'suspended', 'failed')`)
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;
  @Column() name: string;
  @Column({ type: 'varchar', length: 20, default: TenantStatus.PROVISIONING }) status: TenantStatus;
  @Column({ name: 'custom_domain', type: 'varchar', unique: true, nullable: true }) customDomain: string | null;

  // Connection target. NULL host/port/user fall back to the shared DB_* env, so a tenant can be
  // moved to a dedicated server by updating its row (and running migrations there).
  @Column({ name: 'db_name', unique: true }) dbName: string;
  @Column({ name: 'db_host', type: 'varchar', length: 255, nullable: true }) dbHost: string | null;
  @Column({ name: 'db_port', type: 'int', nullable: true }) dbPort: number | null;
  @Column({ name: 'db_user', type: 'varchar', length: 63, nullable: true }) dbUser: string | null;
  /** AES-256-GCM encrypted with TENANT_SECRETS_KEY. Never returned by any API. */
  @Column({ name: 'db_password_enc', type: 'text', nullable: true, select: false }) dbPasswordEnc: string | null;

  @Column({ name: 'provisioning_error', type: 'text', nullable: true, select: false }) provisioningError: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
