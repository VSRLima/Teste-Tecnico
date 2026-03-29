import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { RequestWithContext } from '../common/interfaces/request-with-context.interface';
import { AppLogger } from './app-logger.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();
    const startedAt = performance.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.logWithMetadata(
          'log',
          'HTTP request completed',
          {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            method: request.method,
            path: request.originalUrl ?? request.url,
            requestId: request.requestId,
            statusCode: response.statusCode,
            userId: request.user?.sub,
          },
          HttpLoggingInterceptor.name,
        );
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : typeof (error as { getStatus?: unknown })?.getStatus ===
                'function'
              ? (error as { getStatus: () => number }).getStatus()
              : response.statusCode;

        this.logger.logWithMetadata(
          'error',
          'HTTP request failed',
          {
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
            method: request.method,
            path: request.originalUrl ?? request.url,
            requestId: request.requestId,
            statusCode,
            userId: request.user?.sub,
          },
          HttpLoggingInterceptor.name,
          error instanceof Error ? error.stack : undefined,
        );

        return throwError(() => error);
      }),
    );
  }
}
