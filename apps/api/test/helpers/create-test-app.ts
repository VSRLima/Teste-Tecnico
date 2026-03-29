import { getQueueToken } from '@nestjs/bullmq';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CampaignExpirationSchedulerService } from '../../src/campaigns/campaign-expiration-scheduler.service';
import { CAMPAIGNS_QUEUE_NAME } from '../../src/campaigns/campaigns.queue';
import { AppLogger } from '../../src/observability/app-logger.service';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp() {
  const queueMock = {
    add: jest.fn(),
    getJob: jest.fn().mockResolvedValue(null),
    getJobs: jest.fn().mockResolvedValue([]),
  };
  const schedulerMock = {
    initialize: jest.fn(),
    refreshAllSchedules: jest.fn(),
    refreshCampaignSchedule: jest.fn(),
    scheduleCampaignExpiration: jest.fn(),
    unscheduleCampaignExpiration: jest.fn(),
  };
  const loggerMock = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    logWithMetadata: jest.fn(),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getQueueToken(CAMPAIGNS_QUEUE_NAME))
    .useValue(queueMock)
    .overrideProvider(CampaignExpirationSchedulerService)
    .useValue(schedulerMock)
    .overrideProvider(AppLogger)
    .useValue(loggerMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  return {
    app,
    moduleFixture,
    prisma: moduleFixture.get(PrismaService),
    queueMock,
    schedulerMock,
    loggerMock,
  };
}
