import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { ApiErrors } from './api-response.decorators';
import { PLATFORM_JWT, TENANT_ID, TENANT_JWT } from './swagger.constants';

/** Platform admin access token. */
export const ApiPlatformAuth = () =>
  applyDecorators(ApiBearerAuth(PLATFORM_JWT), ApiErrors({ 401: 'Missing, expired or revoked platform token' }));

/** Public school route: only the x-tenant-id header. */
export const ApiTenantHeader = () =>
  applyDecorators(
    ApiSecurity(TENANT_ID),
    ApiErrors({ 404: 'Unknown school (missing/invalid x-tenant-id)', 403: 'School is temporarily unavailable' }),
  );

/** School route needing x-tenant-id AND a school access token (one requirement = both). */
export const ApiTenantAuth = () =>
  applyDecorators(
    ApiSecurity({ [TENANT_ID]: [], [TENANT_JWT]: [] }),
    ApiErrors({
      401: 'Missing/expired token, token from another school, or revoked session',
      403: 'Missing permission, or code PASSWORD_CHANGE_REQUIRED',
      404: 'Unknown school (missing/invalid x-tenant-id)',
    }),
  );
