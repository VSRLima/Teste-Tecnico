import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CampaignStatus as PrismaCampaignStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignExpirationSchedulerService } from '../campaign-expiration-scheduler.service';
import {
  CAMPAIGNS_QUEUE_NAME,
  CampaignExpirationJobData,
  CampaignExpirationJobNames,
} from '../campaigns.queue';

@Processor(CAMPAIGNS_QUEUE_NAME)
export class CampaignExpirationConsumer extends WorkerHost {
  private readonly logger = new Logger(CampaignExpirationConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerService: CampaignExpirationSchedulerService,
  ) {
    super();
  }

  async process(job: Job<CampaignExpirationJobData>): Promise<void> {
    if (job.name !== CampaignExpirationJobNames.EXPIRE_CAMPAIGN) {
      return;
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: job.data.campaignId },
      select: {
        id: true,
        endDate: true,
        status: true,
      },
    });

    if (!campaign) {
      this.logger.warn(
        `Skipping expiration job for missing campaign ${job.data.campaignId}`,
      );
      return;
    }

    if (
      !campaign.endDate ||
      campaign.status === PrismaCampaignStatus.COMPLETED
    ) {
      return;
    }

    if (
      campaign.endDate.toISOString() !== job.data.endDate ||
      campaign.endDate.getTime() > Date.now()
    ) {
      await this.schedulerService.refreshCampaignSchedule(campaign);
      return;
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: PrismaCampaignStatus.COMPLETED,
      },
    });

    this.logger.log(`Campaign ${campaign.id} marked as completed`);
  }
}
