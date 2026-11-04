import type { Request } from 'express';
import type { Grants } from '../access/access.service';
import type { User } from '../access/entities/user.tenant.entity';
import type { RequestTenant } from '../context/tenant-context';

export interface TenantAuth {
  userId: string;
  sessionId: string;
  tenantId: string;
  user: User;
  /** Request IP (honours TRUST_PROXY), recorded in audit_logs. */
  ip: string | null;
  /** Institution-scope permission codes. Loaded only when the route declared permissions. */
  permissions?: Set<string>;
  /** Every permission with its scopes. Loaded with permissions. */
  grants?: Grants;
}

export type TenantRequest = Request & { tenant: RequestTenant; auth: TenantAuth };

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}
