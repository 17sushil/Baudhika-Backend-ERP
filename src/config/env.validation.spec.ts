import { validateEnv } from './env.validation';

const base = {
  DB_HOST: 'localhost',
  DB_USER: 'u',
  DB_PASS: 'p',
  MASTER_DB_NAME: 'master_db',
  BASE_DOMAIN: 'erp.test',
  PLATFORM_JWT_SECRET: 'p'.repeat(40),
  TENANT_JWT_SECRET: 't'.repeat(40),
  TENANT_SECRETS_KEY: Buffer.alloc(32, 1).toString('base64'),
};

describe('validateEnv', () => {
  it('accepts a complete development config', () => {
    expect(() => validateEnv({ ...base, MAIL_DRIVER: 'console' })).not.toThrow();
  });

  it('rejects identical platform and tenant secrets', () => {
    expect(() => validateEnv({ ...base, TENANT_JWT_SECRET: base.PLATFORM_JWT_SECRET })).toThrow(/must differ/);
  });

  it('rejects short secrets and a bad encryption key', () => {
    expect(() => validateEnv({ ...base, TENANT_JWT_SECRET: 'short' })).toThrow(/at least 32/);
    expect(() => validateEnv({ ...base, TENANT_SECRETS_KEY: 'abc' })).toThrow(/32 bytes/);
  });

  it('refuses the console mail driver in production (it would log OTP codes)', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', MAIL_DRIVER: 'console' })).toThrow(/not allowed in production/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/not allowed in production/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', MAIL_DRIVER: 'ses' })).not.toThrow();
  });
});
