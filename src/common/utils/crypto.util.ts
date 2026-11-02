import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function safeEqual(a: unknown, b: unknown) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "<uuid>.<secret>" opaque tokens: the id finds the row, only the hash of the secret is stored. */
export function parseOpaqueToken(raw: unknown): { id: string; secret: string } | null {
  if (typeof raw !== 'string') return null;
  const [id, secret, extra] = raw.split('.');
  if (!id || !secret || extra !== undefined || !UUID_RE.test(id)) return null;
  return { id, secret };
}

// AES-256-GCM for secrets stored in the master DB (tenant DB passwords).
// Format: v1.<iv>.<tag>.<ciphertext>, all base64url.

function secretsKey(): Buffer {
  const key = Buffer.from(process.env.TENANT_SECRETS_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('TENANT_SECRETS_KEY must be 32 bytes, base64 encoded');
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretsKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decryptSecret(blob: string): string {
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported secret format');
  const decipher = createDecipheriv('aes-256-gcm', secretsKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
