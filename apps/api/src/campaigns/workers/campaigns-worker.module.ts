import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns.module';
import { CampaignExpirationConsumer } from '../consumers/campaign-expiration.consumer';
import { CampaignSchedulerInitializerService } from './campaign-scheduler-initializer.service';

@Module({
  imports: [CampaignsModule],
  providers: [CampaignExpirationConsumer, CampaignSchedulerInitializerService],
})
export class CampaignsWorkerModule {}
