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

    const endDate = new Date(job.data.endDate);
    const updateResult = await this.prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        endDate,
        status: {
          not: PrismaCampaignStatus.COMPLETED,
        },
      },
      data: {
        status: PrismaCampaignStatus.COMPLETED,
      },
    });

    if (updateResult.count === 0) {
      const latestCampaign = await this.prisma.campaign.findUnique({
        where: { id: campaign.id },
        select: {
          id: true,
          endDate: true,
          status: true,
        },
      });

      if (latestCampaign) {
        await this.schedulerService.refreshCampaignSchedule(latestCampaign);
      }

      this.logger.warn(
        `Skipped completing campaign ${campaign.id} because its schedule changed before the atomic update`,
      );
      return;
    }

    this.logger.log(`Campaign ${campaign.id} marked as completed`);
  }
}
