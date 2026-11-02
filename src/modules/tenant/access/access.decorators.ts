import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'tenant:permissions';
export const ALLOW_PENDING_PASSWORD_KEY = 'tenant:allowPendingPassword';

/** Caller must hold every listed permission at institution scope. Requires TenantAuthGuard. */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

/** Route stays reachable while users.must_change_password is true (me, change-password). */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
