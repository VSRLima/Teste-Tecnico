import { Injectable, OnModuleInit } from '@nestjs/common';
import { CampaignExpirationSchedulerService } from '../campaign-expiration-scheduler.service';

@Injectable()
export class CampaignSchedulerInitializerService implements OnModuleInit {
  constructor(
    private readonly schedulerService: CampaignExpirationSchedulerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.schedulerService.initialize();
  }
}
