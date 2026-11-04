const REQUIRED = [
  'DB_HOST',
  'DB_USER',
  'DB_PASS',
  'MASTER_DB_NAME',
  'BASE_DOMAIN',
  'PLATFORM_JWT_SECRET',
  'TENANT_JWT_SECRET',
  'TENANT_SECRETS_KEY',
] as const;

/** Fail fast at boot instead of on the first request that needs a missing setting. */
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);

  for (const k of ['PLATFORM_JWT_SECRET', 'TENANT_JWT_SECRET'] as const) {
    if (String(env[k]).length < 32) throw new Error(`${k} must be at least 32 characters`);
  }
  // Separate secrets: a leaked or forged token for one plane must never verify on the other.
  if (env.PLATFORM_JWT_SECRET === env.TENANT_JWT_SECRET) {
    throw new Error('PLATFORM_JWT_SECRET and TENANT_JWT_SECRET must differ');
  }
  // The console mail driver prints OTP codes to stdout: never acceptable outside development.
  if (env.NODE_ENV === 'production' && (env.MAIL_DRIVER ?? 'console') === 'console') {
    throw new Error('MAIL_DRIVER=console is not allowed in production (it logs OTP codes); configure a real mail provider');
  }
  if (Buffer.from(String(env.TENANT_SECRETS_KEY), 'base64').length !== 32) {
    throw new Error('TENANT_SECRETS_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)');
  }
  return env;
}
