import { applyDecorators, Type } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';

/**
 * Named, valid request bodies for Swagger UI. Without them "Try it out" fills every optional field with a
 * placeholder (e.g. a fake scopeId, or both personId and person), which these endpoints reject by design.
 * The first example is pre-filled; the rest appear in the Examples dropdown.
 */
export const ApiBodyExamples = (type: Type, examples: Record<string, { summary: string; value: object }>) =>
  applyDecorators(ApiBody({ type, examples }));
