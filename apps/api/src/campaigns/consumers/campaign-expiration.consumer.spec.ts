import { CampaignStatus as PrismaCampaignStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CampaignExpirationSchedulerService } from '../campaign-expiration-scheduler.service';
import { CampaignExpirationConsumer } from './campaign-expiration.consumer';

describe('CampaignExpirationConsumer', () => {
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();
  const refreshCampaignScheduleMock = jest.fn();

  const prisma = {
    campaign: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  } as unknown as PrismaService;

  const schedulerService = {
    refreshCampaignSchedule: refreshCampaignScheduleMock,
  } as unknown as CampaignExpirationSchedulerService;

  let consumer: CampaignExpirationConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    consumer = new CampaignExpirationConsumer(prisma, schedulerService);
  });

  it('ignores jobs with an unexpected name', async () => {
    await consumer.process({
      name: 'unexpected-job',
      data: {
        campaignId: 'campaign-1',
        endDate: '2099-04-01T00:00:00.000Z',
      },
    } as never);

    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('skips jobs when the campaign no longer exists', async () => {
    findUniqueMock.mockResolvedValue(null);

    await consumer.process({
      name: 'expire-campaign',
      data: {
        campaignId: 'missing-campaign',
        endDate: '2099-04-01T00:00:00.000Z',
      },
    } as never);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('reschedules jobs when campaign endDate changed or is still in the future', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const campaign = {
      id: 'campaign-1',
      endDate: futureDate,
      status: PrismaCampaignStatus.ACTIVE,
    };

    findUniqueMock.mockResolvedValue(campaign);

    await consumer.process({
      name: 'expire-campaign',
      data: {
        campaignId: 'campaign-1',
        endDate: '2099-04-01T00:00:00.000Z',
      },
    } as never);

    expect(refreshCampaignScheduleMock).toHaveBeenCalledWith(campaign);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('marks campaigns as completed when the scheduled expiration is due', async () => {
    const pastDate = new Date(Date.now() - 60_000);

    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      endDate: pastDate,
      status: PrismaCampaignStatus.ACTIVE,
    });

    await consumer.process({
      name: 'expire-campaign',
      data: {
        campaignId: 'campaign-1',
        endDate: pastDate.toISOString(),
      },
    } as never);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
      data: {
        status: PrismaCampaignStatus.COMPLETED,
      },
    });
  });

  it('returns without changes when the campaign is already completed', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      endDate: new Date('2099-04-01T00:00:00.000Z'),
      status: PrismaCampaignStatus.COMPLETED,
    });

    await consumer.process({
      name: 'expire-campaign',
      data: {
        campaignId: 'campaign-1',
        endDate: '2099-04-01T00:00:00.000Z',
      },
    } as never);

    expect(refreshCampaignScheduleMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
