import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ProvisioningStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity('provisioning_jobs')
export class ProvisioningJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'idempotency_key', unique: true }) idempotencyKey: string;
  @Column() slug: string;
  @Column() name: string;
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true }) tenantId: string | null;
  @Column({ type: 'varchar', length: 20, default: ProvisioningStatus.PENDING }) status: ProvisioningStatus;
  @Column({ type: 'varchar', length: 50, nullable: true }) step: string | null;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}