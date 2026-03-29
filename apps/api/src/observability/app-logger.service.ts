import {
  ConsoleLogger,
  Injectable,
  LogLevel,
  LoggerService,
} from '@nestjs/common';

type StructuredLogPayload = {
  context?: string;
  level: LogLevel | 'fatal';
  message: string;
  metadata?: Record<string, unknown>;
  trace?: string;
};

@Injectable()
export class AppLogger extends ConsoleLogger implements LoggerService {
  override log(message: unknown, context?: string) {
    this.printStructuredLog({
      level: 'log',
      message: this.serializeLogMessage(message),
      context,
    });
  }

  override error(message: unknown, trace?: string, context?: string) {
    this.printStructuredLog({
      level: 'error',
      message: this.serializeLogMessage(message),
      trace,
      context,
    });
  }

  override warn(message: unknown, context?: string) {
    this.printStructuredLog({
      level: 'warn',
      message: this.serializeLogMessage(message),
      context,
    });
  }

  override debug(message: unknown, context?: string) {
    this.printStructuredLog({
      level: 'debug',
      message: this.serializeLogMessage(message),
      context,
    });
  }

  override verbose(message: unknown, context?: string) {
    this.printStructuredLog({
      level: 'verbose',
      message: this.serializeLogMessage(message),
      context,
    });
  }

  logWithMetadata(
    level: LogLevel | 'fatal',
    message: string,
    metadata?: Record<string, unknown>,
    context?: string,
    trace?: string,
  ) {
    this.printStructuredLog({
      level,
      message,
      metadata,
      context,
      trace,
    });
  }

  private printStructuredLog(payload: StructuredLogPayload) {
    const structuredPayload = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: payload.level,
      context: payload.context,
      message: payload.message,
      trace: payload.trace,
      ...payload.metadata,
    });

    switch (payload.level) {
      case 'error':
      case 'fatal':
        console.error(structuredPayload);
        break;
      case 'warn':
        console.warn(structuredPayload);
        break;
      case 'debug':
        console.debug(structuredPayload);
        break;
      default:
        console.log(structuredPayload);
        break;
    }
  }

  private serializeLogMessage(message: unknown) {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    return JSON.stringify(message);
  }
}
