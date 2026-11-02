import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../access/entities/user.tenant.entity';

/**
 * One row per issued refresh token. Rows sharing family_id form one login session;
 * presenting an already-rotated token revokes the whole family (theft detection).
 */
@Entity('user_sessions')
@Index('idx_user_sessions_family', ['familyId'])
@Index('idx_user_sessions_user', ['userId'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'family_id', type: 'uuid' }) familyId: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'token_hash', type: 'varchar', length: 64 }) tokenHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'session_expires_at', type: 'timestamptz' }) sessionExpiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true }) replacedById: string | null;
  @Column({ type: 'inet', nullable: true }) ip: string | null;
  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true }) userAgent: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_user_sessions_user' })
  user?: User;
}
