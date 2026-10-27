import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('platform_audit_events')
export class PlatformAuditEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId: string | null;
  @Column({ length: 100 }) action: string;
  @Column({ name: 'target_type', type: 'varchar', length: 50, nullable: true }) targetType: string | null;
  @Column({ name: 'target_id', type: 'varchar', length: 100, nullable: true }) targetId: string | null;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @CreateDateColumn() createdAt: Date;
}