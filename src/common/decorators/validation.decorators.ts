import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsISO8601, Matches, ValidateIf } from 'class-validator';

export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date "YYYY-MM-DD" that actually exists (2026-02-30 is rejected). */
export const IsDateOnly = () =>
  applyDecorators(Matches(DATE_ONLY_RE, { message: '$property must be YYYY-MM-DD' }), IsISO8601({ strict: true }));

/** Trims strings; an all-space string becomes null so it can't sneak past "required" checks. */
export const Trim = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t === '' ? null : t;
  });

/**
 * PATCH semantics for NOT NULL columns: the field may be omitted, but null is validated (and rejected)
 * instead of being skipped like @IsOptional would do.
 */
export const IsOptionalNonNull = () => ValidateIf((_, v) => v !== undefined);
