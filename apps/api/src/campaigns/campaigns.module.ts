import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CampaignExpirationSchedulerService } from './campaign-expiration-scheduler.service';
import { CampaignsController } from './campaigns.controller';
import { CAMPAIGNS_QUEUE_NAME } from './campaigns.queue';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CAMPAIGNS_QUEUE_NAME,
    }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignExpirationSchedulerService],
  exports: [CampaignsService, CampaignExpirationSchedulerService],
})
export class CampaignsModule {}
