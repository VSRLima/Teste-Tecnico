import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  Campaign,
  CampaignStatus as PrismaCampaignStatus,
} from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGNS_QUEUE_NAME,
  CampaignExpirationJobData,
  CampaignExpirationJobNames,
  getCampaignExpirationJobId,
} from './campaigns.queue';

type CampaignScheduleTarget = Pick<Campaign, 'id' | 'endDate' | 'status'>;

@Injectable()
export class CampaignExpirationSchedulerService {
  private readonly logger = new Logger(CampaignExpirationSchedulerService.name);

  constructor(
    @InjectQueue(CAMPAIGNS_QUEUE_NAME)
    private readonly campaignsQueue: Queue<CampaignExpirationJobData>,
    private readonly prisma: PrismaService,
  ) {}

  async initialize(): Promise<void> {
    this.logger.log('Initializing campaign expiration scheduler...');
    await this.refreshAllSchedules();
    this.logger.log('Campaign expiration scheduler initialized successfully');
  }

  async refreshAllSchedules(): Promise<void> {
    this.logger.log('Refreshing campaign expiration schedules...');

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        endDate: {
          not: null,
        },
      },
      select: {
        id: true,
        endDate: true,
        status: true,
      },
    });

    const existingJobsById = new Map<string, Job<CampaignExpirationJobData>>(
      (await this.campaignsQueue.getJobs(['delayed', 'waiting', 'prioritized']))
        .filter(
          (job): job is Job<CampaignExpirationJobData> =>
            typeof job.id === 'string' &&
            job.id.startsWith('campaign-expiration-'),
        )
        .map((job) => [job.id as string, job]),
    );

    let createdCount = 0;
    let updatedCount = 0;
    let removedCount = 0;

    for (const campaign of campaigns) {
      const jobId = getCampaignExpirationJobId(campaign.id);
      const existingJob = existingJobsById.get(jobId);

      if (
        campaign.status === PrismaCampaignStatus.COMPLETED ||
        !campaign.endDate
      ) {
        if (existingJob) {
          await existingJob.remove();
          removedCount++;
        }
        existingJobsById.delete(jobId);
        continue;
      }

      if (!existingJob) {
        await this.scheduleCampaignExpiration(campaign);
        createdCount++;
      } else if (existingJob.data.endDate !== campaign.endDate.toISOString()) {
        await this.scheduleCampaignExpiration(campaign);
        updatedCount++;
      }

      existingJobsById.delete(jobId);
    }

    for (const orphanedJob of existingJobsById.values()) {
      await orphanedJob.remove();
      removedCount++;
    }

    this.logger.log(
      `Campaign expiration schedules refreshed: ${createdCount} created, ` +
        `${updatedCount} updated, ${removedCount} removed. ` +
        `Total with endDate: ${campaigns.length}`,
    );
  }

  async refreshCampaignSchedule(
    campaign: CampaignScheduleTarget,
  ): Promise<void> {
    if (
      !campaign.endDate ||
      campaign.status === PrismaCampaignStatus.COMPLETED
    ) {
      await this.unscheduleCampaignExpiration(campaign.id);
      return;
    }

    const existingJob = await this.campaignsQueue.getJob(
      getCampaignExpirationJobId(campaign.id),
    );

    if (existingJob?.data.endDate === campaign.endDate.toISOString()) {
      return;
    }

    await this.scheduleCampaignExpiration(campaign);
  }

  async scheduleCampaignExpiration(
    campaign: CampaignScheduleTarget,
  ): Promise<void> {
    if (
      !campaign.endDate ||
      campaign.status === PrismaCampaignStatus.COMPLETED
    ) {
      await this.unscheduleCampaignExpiration(campaign.id);
      return;
    }

    await this.unscheduleCampaignExpiration(campaign.id);

    const jobId = getCampaignExpirationJobId(campaign.id);
    const endDate = campaign.endDate.toISOString();
    const delay = Math.max(campaign.endDate.getTime() - Date.now(), 0);
    const data: CampaignExpirationJobData = {
      campaignId: campaign.id,
      endDate,
    };
    const options = {
      jobId,
      delay,
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 1000,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
    };

    try {
      await this.campaignsQueue.add(
        CampaignExpirationJobNames.EXPIRE_CAMPAIGN,
        data,
        options,
      );
    } catch (error) {
      try {
        await this.campaignsQueue.add(
          CampaignExpirationJobNames.EXPIRE_CAMPAIGN,
          data,
          options,
        );
      } catch (recoveryError) {
        this.logger.error(
          `Failed to schedule expiration job for campaign ${campaign.id} and recovery attempt also failed`,
          recoveryError instanceof Error
            ? recoveryError.stack
            : String(recoveryError),
          error instanceof Error ? error.stack : String(error),
        );
      }

      throw error;
    }

    this.logger.log(
      `Scheduled campaign ${campaign.id} to expire at ${endDate}`,
    );
  }

  async unscheduleCampaignExpiration(campaignId: string): Promise<void> {
    const job = await this.campaignsQueue.getJob(
      getCampaignExpirationJobId(campaignId),
    );

    if (!job) {
      return;
    }

    await job.remove();
    this.logger.log(`Unscheduled campaign expiration for ${campaignId}`);
  }
}
