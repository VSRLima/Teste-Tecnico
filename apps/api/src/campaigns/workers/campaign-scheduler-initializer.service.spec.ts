import { CampaignExpirationSchedulerService } from '../campaign-expiration-scheduler.service';
import { CampaignSchedulerInitializerService } from './campaign-scheduler-initializer.service';

describe('CampaignSchedulerInitializerService', () => {
  it('initializes the campaign scheduler on module startup', async () => {
    const initializeMock = jest.fn();
    const schedulerService = {
      initialize: initializeMock,
    } as unknown as CampaignExpirationSchedulerService;

    const service = new CampaignSchedulerInitializerService(schedulerService);

    await service.onModuleInit();

    expect(initializeMock).toHaveBeenCalledTimes(1);
  });
});
