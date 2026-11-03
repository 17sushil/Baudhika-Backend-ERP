import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Shape added by TransformInterceptor around every success body. */
export class SuccessEnvelopeSchema {
  @ApiProperty({ example: 200 }) statusCode: number;
  @ApiProperty({ example: 'success' }) message: string;
}

/** Nest's standard error body. Validation errors return message as string[]. */
export class ErrorSchema {
  @ApiProperty({ example: 401 }) statusCode: number;
  @ApiProperty({ example: 'Unauthorized' }) error: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], example: 'Unauthorized' })
  message: string | string[];
  @ApiPropertyOptional({ example: 'PASSWORD_CHANGE_REQUIRED', description: 'Machine-readable reason, when the client must act' })
  code?: string;
}
