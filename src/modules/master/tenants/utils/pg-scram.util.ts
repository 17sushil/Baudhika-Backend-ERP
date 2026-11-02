import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'crypto';

/**
 * Pre-computed SCRAM-SHA-256 verifier for CREATE/ALTER ROLE ... PASSWORD '<verifier>'.
 * Postgres stores it as-is, so the plaintext DB password never appears in SQL or server logs.
 */
export function scramSha256Verifier(password: string, iterations = 4096): string {
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}
