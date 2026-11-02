import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlatformUser } from './platform-user.master.entity';

@Entity('platform_otp_challenges')
export class PlatformOtpChallenge {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @ManyToOne(() => PlatformUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_platform_otp_challenges_user' })
  user?: PlatformUser;
  @Column({ name: 'code_hash', length: 64 }) codeHash: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}