import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

export interface SuccessEnvelope<T> {
  statusCode: number;
  message: 'success';
  data: T | null;
}

/** Wraps every successful response as { statusCode, message: 'success', data }. Errors are untouched. */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    // Read the status after the handler runs so @HttpCode / 201 defaults are reflected.
    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode ?? 200,
        message: 'success' as const,
        data: data ?? null,
      })),
    );
  }
}
