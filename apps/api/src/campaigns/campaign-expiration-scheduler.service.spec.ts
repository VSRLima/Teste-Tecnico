import { CampaignStatus as PrismaCampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignExpirationSchedulerService } from './campaign-expiration-scheduler.service';
import {
  CampaignExpirationJobNames,
  getCampaignExpirationJobId,
} from './campaigns.queue';

describe('CampaignExpirationSchedulerService', () => {
  const addMock = jest.fn();
  const getJobMock = jest.fn();
  const getJobsMock = jest.fn();
  const findManyMock = jest.fn();
  const loggerErrorMock = jest.fn();

  const queue = {
    add: addMock,
    getJob: getJobMock,
    getJobs: getJobsMock,
  };

  const prisma = {
    campaign: {
      findMany: findManyMock,
    },
  } as unknown as PrismaService;

  let service: CampaignExpirationSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CampaignExpirationSchedulerService(queue as never, prisma);
    (
      service as unknown as {
        logger: { log: jest.Mock; error: typeof loggerErrorMock };
      }
    ).logger = {
      log: jest.fn(),
      error: loggerErrorMock,
    };
  });

  it('initializes by refreshing all schedules', async () => {
    const refreshSpy = jest
      .spyOn(service, 'refreshAllSchedules')
      .mockResolvedValue(undefined);

    await service.initialize();

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshes all schedules creating, updating and removing jobs as needed', async () => {
    const freshCampaign = {
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    };
    const updatedCampaign = {
      id: 'campaign-2',
      endDate: new Date('2099-05-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    };
    const completedCampaign = {
      id: 'campaign-3',
      endDate: new Date('2099-06-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.COMPLETED,
    };

    const staleJob = {
      id: getCampaignExpirationJobId(updatedCampaign.id),
      data: { endDate: '2099-04-01T00:00:00.000Z' },
      remove: jest.fn(),
    };
    const completedJob = {
      id: getCampaignExpirationJobId(completedCampaign.id),
      data: { endDate: completedCampaign.endDate.toISOString() },
      remove: jest.fn(),
    };
    const orphanJob = {
      id: getCampaignExpirationJobId('orphan-campaign'),
      data: { endDate: '2099-07-01T00:00:00.000Z' },
      remove: jest.fn(),
    };

    findManyMock.mockResolvedValue([
      freshCampaign,
      updatedCampaign,
      completedCampaign,
    ]);
    getJobsMock.mockResolvedValue([staleJob, completedJob, orphanJob]);
    const scheduleSpy = jest
      .spyOn(service, 'scheduleCampaignExpiration')
      .mockResolvedValue(undefined);

    await service.refreshAllSchedules();

    expect(scheduleSpy).toHaveBeenCalledWith(freshCampaign);
    expect(scheduleSpy).toHaveBeenCalledWith(updatedCampaign);
    expect(completedJob.remove).toHaveBeenCalledTimes(1);
    expect(orphanJob.remove).toHaveBeenCalledTimes(1);
  });

  it('refreshes a campaign schedule by unscheduling completed campaigns', async () => {
    const unscheduleSpy = jest
      .spyOn(service, 'unscheduleCampaignExpiration')
      .mockResolvedValue(undefined);

    await service.refreshCampaignSchedule({
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.COMPLETED,
    });

    expect(unscheduleSpy).toHaveBeenCalledWith('campaign-1');
  });

  it('refreshes a campaign schedule without requeueing when endDate did not change', async () => {
    const campaign = {
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    };

    getJobMock.mockResolvedValue({
      data: { endDate: campaign.endDate.toISOString() },
    });
    const scheduleSpy = jest
      .spyOn(service, 'scheduleCampaignExpiration')
      .mockResolvedValue(undefined);

    await service.refreshCampaignSchedule(campaign);

    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it('refreshes a campaign schedule by requeueing when the stored job is stale', async () => {
    const campaign = {
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    };

    getJobMock.mockResolvedValue({
      data: { endDate: '2099-03-01T00:00:00.000Z' },
    });
    const scheduleSpy = jest
      .spyOn(service, 'scheduleCampaignExpiration')
      .mockResolvedValue(undefined);

    await service.refreshCampaignSchedule(campaign);

    expect(scheduleSpy).toHaveBeenCalledWith(campaign);
  });

  it('schedules campaign expiration with a delayed BullMQ job', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const removeMock = jest.fn();

    getJobMock.mockResolvedValue({ remove: removeMock });

    await service.scheduleCampaignExpiration({
      id: 'campaign-1',
      endDate: futureDate,
      status: PrismaCampaignStatus.ACTIVE,
    });

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      CampaignExpirationJobNames.EXPIRE_CAMPAIGN,
      {
        campaignId: 'campaign-1',
        endDate: futureDate.toISOString(),
      },
      expect.objectContaining({
        jobId: getCampaignExpirationJobId('campaign-1'),
        attempts: 3,
        removeOnComplete: true,
      }),
    );
  });

  it('retries once and rethrows when scheduling fails', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const originalError = new Error('first add failed');
    const recoveryError = new Error('recovery add failed');

    getJobMock.mockResolvedValue(null);
    addMock
      .mockRejectedValueOnce(originalError)
      .mockRejectedValueOnce(recoveryError);

    await expect(
      service.scheduleCampaignExpiration({
        id: 'campaign-1',
        endDate: futureDate,
        status: PrismaCampaignStatus.ACTIVE,
      }),
    ).rejects.toThrow(originalError);

    expect(addMock).toHaveBeenCalledTimes(2);
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it('does not enqueue completed campaigns', async () => {
    const unscheduleSpy = jest
      .spyOn(service, 'unscheduleCampaignExpiration')
      .mockResolvedValue(undefined);

    await service.scheduleCampaignExpiration({
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.COMPLETED,
    });

    expect(unscheduleSpy).toHaveBeenCalledWith('campaign-1');
    expect(addMock).not.toHaveBeenCalled();
  });

  it('unschedules campaign expiration when a delayed job exists', async () => {
    const removeMock = jest.fn();

    getJobMock.mockResolvedValue({ remove: removeMock });

    await service.unscheduleCampaignExpiration('campaign-1');

    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when unscheduling a missing delayed job', async () => {
    getJobMock.mockResolvedValue(null);

    await expect(
      service.unscheduleCampaignExpiration('missing-campaign'),
    ).resolves.toBeUndefined();
  });
});
