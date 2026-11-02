import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Tenant } from './tenant.master.entity';

@Entity('tenant_branding')
export class TenantBranding {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' }) tenantId: string;

  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'display_name', length: 100 }) displayName: string;
  @Column({ name: 'short_name', type: 'varchar', length: 30, nullable: true }) shortName: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) description: string | null;
  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true }) logoUrl: string | null;
  @Column({ name: 'favicon_url', type: 'varchar', length: 500, nullable: true }) faviconUrl: string | null;
  @Column({ name: 'primary_color', length: 7, default: '#2563EB' }) primaryColor: string;
  @Column({ name: 'secondary_color', length: 7, default: '#0F172A' }) secondaryColor: string;
  @Column({ length: 10, default: 'en' }) language: string;
  @UpdateDateColumn({ name: 'published_at', type: 'timestamptz' }) publishedAt: Date;
}