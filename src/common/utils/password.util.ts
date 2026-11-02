import * as argon2 from 'argon2';

// argon2id with OWASP-recommended minimums (19 MiB, t=2).
const HASH_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, HASH_OPTS);

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false; // malformed hash: treat as a mismatch, never as a 500
  }
}

let dummy: Promise<string> | undefined;

/** Burns the same time as a real verify, so responses don't reveal whether an account exists. */
export async function verifyDummy(plain: string): Promise<false> {
  dummy ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummy, plain);
  return false;
}

/** Default school password policy: 8-128 chars with at least one letter and one digit. */
export const PASSWORD_POLICY_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
export const PASSWORD_POLICY_MESSAGE = 'Password must be 8-128 characters and contain a letter and a digit';
