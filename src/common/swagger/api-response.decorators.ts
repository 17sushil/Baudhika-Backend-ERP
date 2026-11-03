import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiNoContentResponse, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ErrorSchema, SuccessEnvelopeSchema } from './swagger.schemas';

interface EnvelopeOptions {
  status?: number;
  isArray?: boolean;
  description?: string;
}

/**
 * Documents a success response as { statusCode, message: 'success', data: <model> }.
 * Pass several models for a "one of" body (e.g. login: authenticated | otp_required).
 */
export function ApiEnvelope(model: Type | Type[], { status = HttpStatus.OK, isArray = false, description }: EnvelopeOptions = {}) {
  const models = Array.isArray(model) ? model : [model];
  const ref = models.length > 1 ? { oneOf: models.map((m) => ({ $ref: getSchemaPath(m) })) } : { $ref: getSchemaPath(models[0]) };

  return applyDecorators(
    ApiExtraModels(SuccessEnvelopeSchema, ...models),
    ApiResponse({
      status,
      description: description ?? 'Success',
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessEnvelopeSchema) },
          {
            properties: {
              statusCode: { type: 'number', example: status },
              data: isArray ? { type: 'array', items: ref } : ref,
            },
          },
        ],
      },
    }),
  );
}

export const ApiNoContent = (description = 'No content') => ApiNoContentResponse({ description });

/** Documents error responses: { 400: 'Validation failed', 409: 'Slug taken' }. */
export function ApiErrors(errors: Record<number, string>) {
  return applyDecorators(
    ApiExtraModels(ErrorSchema),
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({ status: +status, description, schema: { $ref: getSchemaPath(ErrorSchema) } }),
    ),
  );
}
