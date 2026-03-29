import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppLogger } from './app-logger.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

@Module({
  controllers: [HealthController],
  providers: [
    AppLogger,
    HealthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
  exports: [AppLogger, HealthService],
})
export class ObservabilityModule {}
