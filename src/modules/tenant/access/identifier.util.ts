/** Usernames start with a letter, so they can never be confused with a phone number or an email. */
export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9._-]{2,49}$/;
export const PHONE_RE = /^\+?\d{7,15}$/;

export const normalizePhone = (v: string) => v.replace(/[\s\-()]/g, '');

export type LoginIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'username'; value: string };

export function classifyIdentifier(raw: string): LoginIdentifier | null {
  const v = raw.trim();
  if (v.includes('@')) return { kind: 'email', value: v.toLowerCase() };
  const phone = normalizePhone(v);
  if (PHONE_RE.test(phone)) return { kind: 'phone', value: phone };
  if (USERNAME_RE.test(v)) return { kind: 'username', value: v };
  return null;
}
