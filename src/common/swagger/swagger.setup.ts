import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TENANT_HEADER } from '../../modules/tenant/context/tenant.middleware';
import { PLATFORM_JWT, TENANT_ID, TENANT_JWT } from './swagger.constants';

export const SWAGGER_PATH = 'docs';

/** On unless NODE_ENV=production; SWAGGER_ENABLED=true|false overrides. */
export function swaggerEnabled(): boolean {
  const flag = process.env.SWAGGER_ENABLED;
  if (flag !== undefined && flag !== '') return flag === 'true';
  return process.env.NODE_ENV !== 'production';
}

/** Serves Swagger UI at /docs and the OpenAPI JSON at /docs-json. */
export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('School ERP API')
    .setDescription(
      'Multi-tenant School ERP backend.\n\n' +
        'Every success response is wrapped as `{ statusCode, message: "success", data }`; errors use ' +
        '`{ statusCode, error, message }`.\n\n' +
        '**Platform** routes (`/platform/auth`, `/tenants`) use the platform JWT. **School** routes (`/auth`, `/users`) ' +
        'need the `x-tenant-id` header (school slug) and, when locked, the school JWT. Tokens from one plane are ' +
        'rejected by the other, and a school token only works for the school that issued it.\n\n' +
        'In development, OTP codes are printed in the server log: `[DEV MAIL] OTP for <email>: 123456`.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Platform admin access token' }, PLATFORM_JWT)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'School user access token' }, TENANT_JWT)
    .addApiKey({ type: 'apiKey', in: 'header', name: TENANT_HEADER, description: 'School slug, e.g. sunrise' }, TENANT_ID)
    .addTag('App', 'Service info and health')
    .addTag('Platform Auth', 'ERP operator login (password + email OTP)')
    .addTag('Tenants', 'School registry and provisioning (platform admin)')
    .addTag('Public', 'Unauthenticated lookups for the frontend')
    .addTag('School Auth', 'School user login, OTP, sessions')
    .addTag('Users', 'School user management and role assignment (school admin)')
    .addTag('Roles', 'Roles, permission catalogue and the role hierarchy (admin always holds everything)')
    .addTag('Organization', 'Campuses (school/college branches), departments, designations, number series')
    .addTag('Persons', 'One record per human: contacts, addresses, login link')
    .addTag('Students', 'Admission, status lifecycle, health, guardian links')
    .addTag('Guardians', 'Parents and guardians')
    .addTag('Staff', 'Employees, teacher/driver profiles, qualifications')
    .addTag('Dashboard', 'KPIs: total students, total staff (scope-aware)')
    .addTag('Audit', 'Append-only change log')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    customSiteTitle: 'School ERP API',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none', displayRequestDuration: true },
  });
}
