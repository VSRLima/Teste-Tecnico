import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CampaignExpirationSchedulerService } from '../campaign-expiration-scheduler.service';

@Injectable()
export class CampaignSchedulerInitializerService implements OnModuleInit {
  private readonly logger = new Logger(
    CampaignSchedulerInitializerService.name,
  );

  constructor(
    private readonly schedulerService: CampaignExpirationSchedulerService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.schedulerService.initialize();
    } catch (error) {
      this.logger.error(
        'Failed to initialize scheduler',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
