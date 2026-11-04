import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger, SWAGGER_PATH, swaggerEnabled } from './common/swagger/swagger.setup';
import { TenantsService } from './modules/master/tenants/services/tenants.service';
import { TENANT_HEADER } from './modules/tenant/context/tenant.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Number of reverse proxies in front of the app; makes req.ip (rate limits, sessions) trustworthy.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? +trustProxy : trustProxy);
  else if (process.env.NODE_ENV === 'production') {
    // Behind a load balancer every client would share the proxy's IP: one attacker could exhaust the login rate limit for everyone.
    logger.warn('TRUST_PROXY is not set: if the app runs behind a proxy/load balancer, rate limits and audit IPs see the proxy address');
  }

  app.use(helmet());
  app.enableCors(corsOptions(app.get(TenantsService)));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  if (swaggerEnabled()) setupSwagger(app);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  if (swaggerEnabled()) logger.log(`API docs: http://localhost:${port}/${SWAGGER_PATH}`);
}

/** Allow the platform domain, every school subdomain, active custom domains and CORS_ORIGINS. */
function corsOptions(tenants: TenantsService) {
  const base = (process.env.BASE_DOMAIN ?? '').toLowerCase();
  const extra = new Set((process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean));

  return {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || extra.has(origin)) return cb(null, true); // non-browser clients send no Origin
      let host: string;
      try {
        host = new URL(origin).hostname.toLowerCase();
      } catch {
        return cb(null, false);
      }
      if (host === base || host.endsWith(`.${base}`)) return cb(null, true);
      tenants.isActiveCustomDomain(host).then(
        (ok) => cb(null, ok),
        () => cb(null, false),
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', TENANT_HEADER],
    credentials: false, // bearer tokens only, no cookies
    maxAge: 600,
  };
}

void bootstrap();
