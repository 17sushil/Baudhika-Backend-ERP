import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('platform_refresh_tokens')
export class PlatformRefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ name: 'family_id', type: 'uuid' }) familyId: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'token_hash', length: 64 }) tokenHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'session_expires_at', type: 'timestamptz' }) sessionExpiresAt: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true }) replacedById: string | null;
  @CreateDateColumn() createdAt: Date;
}