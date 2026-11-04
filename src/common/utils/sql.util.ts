import { QueryFailedError } from 'typeorm';

/** Escape LIKE wildcards in user input; use with ESCAPE '\'. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** True for a Postgres unique violation, optionally on a specific constraint/index. */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  if (!(e instanceof QueryFailedError)) return false;
  const err = e as QueryFailedError & { code?: string; constraint?: string };
  return err.code === '23505' && (!constraint || err.constraint === constraint);
}

/** True for a Postgres CHECK constraint violation (e.g. leaving_date before admission_date). */
export function isCheckViolation(e: unknown): boolean {
  return e instanceof QueryFailedError && (e as QueryFailedError & { code?: string }).code === '23514';
}
