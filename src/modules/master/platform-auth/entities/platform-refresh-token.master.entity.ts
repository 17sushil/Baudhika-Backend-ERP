import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlatformUser } from './platform-user.master.entity';

@Entity('platform_refresh_tokens')
export class PlatformRefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ name: 'family_id', type: 'uuid' }) familyId: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => PlatformUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_platform_refresh_tokens_user' })
  user?: PlatformUser;
  @Column({ name: 'token_hash', length: 64 }) tokenHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'session_expires_at', type: 'timestamptz' }) sessionExpiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true }) replacedById: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}