import { ForbiddenException } from '@nestjs/common';
import type { TenantAuth } from '../auth/auth.types';

/**
 * Campuses the caller may act on for a permission:
 *   null      -> institution-wide (no filter)
 *   string[]  -> only these campuses (possibly empty = nothing)
 * Fails closed when grants weren't loaded (route without @RequireAccess / @RequirePermissions).
 */
export function campusScope(auth: TenantAuth, perm: string): string[] | null {
  const g = auth.grants?.get(perm);
  if (!g) return [];
  return g.institution ? null : [...g.campusIds];
}

/** May the caller use this permission on a record of this campus? NULL campus = institution-level only. */
export function canOnCampus(auth: TenantAuth, perm: string, campusId: string | null | undefined): boolean {
  const g = auth.grants?.get(perm);
  if (!g) return false;
  return g.institution || (!!campusId && g.campusIds.has(campusId));
}

/** Holds the permission at any scope. */
export function hasPermission(auth: TenantAuth, perm: string): boolean {
  const g = auth.grants?.get(perm);
  return !!g && (g.institution || g.campusIds.size > 0);
}

export function assertCanOnCampus(auth: TenantAuth, perm: string, campusId: string | null | undefined) {
  if (!canOnCampus(auth, perm, campusId)) {
    throw new ForbiddenException(campusId ? 'No access to this campus' : `Missing institution-wide permission: ${perm}`);
  }
}

export function assertPermission(auth: TenantAuth, perm: string) {
  if (!hasPermission(auth, perm)) throw new ForbiddenException(`Missing permission: ${perm}`);
}
