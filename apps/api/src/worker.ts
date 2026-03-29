import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const logger = new Logger('CampaignsWorker');
  let app:
    | Awaited<ReturnType<typeof NestFactory.createApplicationContext>>
    | undefined;

  try {
    app = await NestFactory.createApplicationContext(WorkerModule);
    app.enableShutdownHooks();
    logger.log('Campaign worker is running');
  } catch (error) {
    logger.error(
      'Failed to bootstrap campaign worker',
      error instanceof Error ? error.stack : String(error),
    );
    process.exit(1);
  }
}

void bootstrap();
