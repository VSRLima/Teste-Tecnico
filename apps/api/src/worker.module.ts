import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CampaignsWorkerModule } from './campaigns/workers/campaigns-worker.module';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    QueueModule,
    CampaignsWorkerModule,
  ],
})
export class WorkerModule {}
