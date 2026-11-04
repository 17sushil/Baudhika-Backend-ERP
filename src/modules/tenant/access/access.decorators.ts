import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'tenant:permissions';
export const SCOPED_PERMISSIONS_KEY = 'tenant:scopedPermissions';
export const ANY_PERMISSIONS_KEY = 'tenant:anyPermissions';
export const ALLOW_PENDING_PASSWORD_KEY = 'tenant:allowPendingPassword';

/** Caller must hold every listed permission at institution scope. Requires TenantAuthGuard. */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

/**
 * Caller must hold every listed permission at institution scope OR at campus scope (a branch admin).
 * The service must then restrict data with campusScope()/canOnCampus() from access/scope.util.
 */
export const RequireAccess = (...codes: string[]) => SetMetadata(SCOPED_PERMISSIONS_KEY, codes);

/**
 * Caller must hold AT LEAST ONE of the permissions (any scope). For aggregate views (dashboards) that show
 * each section only to holders of its permission; the service decides per section with hasPermission().
 */
export const RequireAnyAccess = (...codes: string[]) => SetMetadata(ANY_PERMISSIONS_KEY, codes);

/** Route stays reachable while users.must_change_password is true (me, change-password). */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
