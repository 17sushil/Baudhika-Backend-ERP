import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TenantStatus {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  FAILED = 'failed',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) slug: string;
  @Column() name: string;
  @Column({ name: 'db_name', unique: true }) dbName: string;
  @Column({ type: 'varchar', length: 20, default: TenantStatus.PROVISIONING }) status: TenantStatus;
  @Column({ name: 'custom_domain', type: 'varchar', unique: true, nullable: true }) customDomain: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}