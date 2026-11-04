import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction } from '../audit.enums';

/** Append-only change log (a trigger rejects UPDATE/DELETE). No FKs so it outlives the rows it describes. */
@Entity('audit_logs')
@Index('idx_audit_logs_record', ['tableName', 'recordId'])
@Index('idx_audit_logs_changed_at', ['changedAt'])
export class AuditLog {
  /** bigserial comes back from pg as a string. */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id: string;
  @Column({ name: 'table_name', type: 'text' }) tableName: string;
  @Column({ name: 'record_id', type: 'uuid' }) recordId: string;
  @Column({ type: 'enum', enum: AuditAction, enumName: 'audit_action' }) action: AuditAction;
  @Column({ name: 'old_data', type: 'jsonb', nullable: true }) oldData: Record<string, unknown> | null;
  @Column({ name: 'new_data', type: 'jsonb', nullable: true }) newData: Record<string, unknown> | null;
  @Column({ name: 'changed_by', type: 'uuid', nullable: true }) changedBy: string | null;
  @Column({ name: 'changed_at', type: 'timestamptz', default: () => 'now()' }) changedAt: Date;
  @Column({ name: 'ip_address', type: 'inet', nullable: true }) ipAddress: string | null;
}
