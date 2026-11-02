import type { Request } from 'express';
import type { User } from '../access/entities/user.tenant.entity';
import type { RequestTenant } from '../context/tenant-context';

export interface TenantAuth {
  userId: string;
  sessionId: string;
  tenantId: string;
  user: User;
  /** Loaded only when the route declared @RequirePermissions. */
  permissions?: Set<string>;
}

export type TenantRequest = Request & { tenant: RequestTenant; auth: TenantAuth };

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}
