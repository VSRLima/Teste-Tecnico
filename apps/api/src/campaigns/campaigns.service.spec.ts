import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CampaignStatus as PrismaCampaignStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignExpirationSchedulerService } from './campaign-expiration-scheduler.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  const createMock = jest.fn();
  const findFirstMock = jest.fn();
  const findManyMock = jest.fn();
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();

  const prismaService = {
    campaign: {
      create: createMock,
      findFirst: findFirstMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  } as unknown as PrismaService;

  const schedulerService = {
    refreshCampaignSchedule: jest.fn(),
    unscheduleCampaignExpiration: jest.fn(),
  } as unknown as CampaignExpirationSchedulerService;

  let service: CampaignsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
    service = new CampaignsService(prismaService, schedulerService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists only own campaigns for managers', async () => {
    findManyMock.mockResolvedValue([]);

    await service.findAll({
      role: 'MANAGER',
      sub: 'manager-1',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'manager-1' },
      }),
    );
  });

  it('lists all campaigns for admins', async () => {
    findManyMock.mockResolvedValue([]);

    await service.findAll({
      role: 'ADMIN',
      sub: 'admin-1',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      }),
    );
  });

  it('creates a campaign with draft as default status and schedules expiration', async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      id: 'campaign-1',
      name: 'Campaign',
      ownerId: 'manager-1',
      status: PrismaCampaignStatus.DRAFT,
      endDate: new Date('2026-04-10T00:00:00.000Z'),
    });

    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'Campaign',
      description: 'Description',
      budget: 1200.5,
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-10T00:00:00.000Z',
    });

    await service.create(dto, {
      role: 'MANAGER',
      sub: 'manager-1',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'manager-1',
          status: PrismaCampaignStatus.DRAFT,
        }),
      }),
    );
    expect(schedulerService.refreshCampaignSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'campaign-1',
      }),
    );
  });

  it('maps prisma duplicate campaign creation errors to conflict', async () => {
    findFirstMock.mockResolvedValue(null);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'Campaign',
      description: 'Description',
      budget: 1200.5,
      startDate: '2026-04-01T00:00:00.000Z',
    });

    await expect(
      service.create(dto, {
        role: 'MANAGER',
        sub: 'manager-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents creating duplicated campaign names for the same owner', async () => {
    findFirstMock.mockResolvedValue({ id: 'campaign-1' });

    await expect(
      service.create(
        {
          name: 'Campaign',
          description: 'Description',
          budget: 1200.5,
          startDate: '2026-04-01T00:00:00.000Z',
          status: 'DRAFT',
        } as CreateCampaignDto,
        {
          role: 'MANAGER',
          sub: 'manager-1',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("prevents managers from reading another owner's campaign", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'owner-2',
    });

    await expect(
      service.findOne('campaign-1', {
        role: 'MANAGER',
        sub: 'owner-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when campaign does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      service.findOne('campaign-1', {
        role: 'ADMIN',
        sub: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows admins to read campaigns owned by other users', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-2',
    });

    await expect(
      service.findOne('campaign-1', {
        role: 'ADMIN',
        sub: 'admin-1',
      }),
    ).resolves.toEqual({
      id: 'campaign-1',
      ownerId: 'manager-2',
    });
  });

  it('updates campaign gracefully and reschedules expiration', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
      name: 'Campaign One',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });
    findFirstMock.mockResolvedValue(null);
    updateMock.mockResolvedValue({
      id: 'campaign-1',
      name: 'Updated campaign',
      endDate: new Date('2026-04-12T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    });

    const result = await service.update(
      'campaign-1',
      {
        name: 'Updated campaign',
        budget: 5000,
        endDate: '2026-04-12T00:00:00.000Z',
      },
      {
        role: 'MANAGER',
        sub: 'manager-1',
      },
    );

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(schedulerService.refreshCampaignSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'campaign-1' }),
    );
    expect(result).toEqual({
      id: 'campaign-1',
      name: 'Updated campaign',
      endDate: new Date('2026-04-12T00:00:00.000Z'),
      status: PrismaCampaignStatus.ACTIVE,
    });
  });

  it('updates campaign endDate to null when explicitly clearing it', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
      name: 'Campaign One',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });
    updateMock.mockResolvedValue({
      id: 'campaign-1',
      endDate: null,
      status: PrismaCampaignStatus.ACTIVE,
    });

    await service.update(
      'campaign-1',
      {
        endDate: null,
      },
      {
        role: 'MANAGER',
        sub: 'manager-1',
      },
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          endDate: null,
        }),
      }),
    );
  });

  it('throws notFoundException trying to update an inexistent campaign', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      service.update(
        'campaign-1',
        { name: 'Updated campaign' },
        {
          role: 'ADMIN',
          sub: 'admin-1',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws forbiddenAccess trying to update a campaign that the user doesn't have access to", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-2',
      name: 'Campaign One',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    await expect(
      service.update(
        'campaign-1',
        { name: 'Updated campaign' },
        {
          role: 'MANAGER',
          sub: 'manager-1',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes campaign gracefully and unschedules expiration', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
    });
    deleteMock.mockResolvedValue({
      id: 'campaign-1',
    });

    const result = await service.remove('campaign-1', {
      role: 'MANAGER',
      sub: 'manager-1',
    });

    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: 'campaign-1' },
    });
    expect(schedulerService.unscheduleCampaignExpiration).toHaveBeenCalledWith(
      'campaign-1',
    );
    expect(result).toEqual({
      message: 'Campaign deleted successfully',
    });
  });

  it('throws notFoundException trying to delete an inexistent campaign', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      service.remove('campaign-1', {
        role: 'ADMIN',
        sub: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws forbiddenAccess trying to delete a campaign that the user doesn't have access to", async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-2',
    });

    await expect(
      service.remove('campaign-1', {
        role: 'MANAGER',
        sub: 'manager-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects campaign creation with a startDate earlier than today', async () => {
    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'Campaign',
      description: 'Description',
      budget: 1200.5,
      startDate: '2026-03-28T00:00:00.000Z',
    });

    await expect(
      service.create(dto, {
        role: 'MANAGER',
        sub: 'manager-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects campaign creation with an endDate earlier than today', async () => {
    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'Campaign',
      description: 'Description',
      budget: 1200.5,
      startDate: '2026-03-29T00:00:00.000Z',
      endDate: '2026-03-28T00:00:00.000Z',
    });

    await expect(
      service.create(dto, {
        role: 'MANAGER',
        sub: 'manager-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects campaign creation when endDate is earlier than startDate', async () => {
    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'Campaign',
      description: 'Description',
      budget: 1200.5,
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-03-31T00:00:00.000Z',
    });

    await expect(
      service.create(dto, {
        role: 'MANAGER',
        sub: 'manager-1',
      }),
    ).rejects.toThrow('End date must be on or after the start date');

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects campaign update with a startDate earlier than today', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
      name: 'Campaign One',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    await expect(
      service.update(
        'campaign-1',
        {
          startDate: '2026-03-28T00:00:00.000Z',
        },
        {
          role: 'MANAGER',
          sub: 'manager-1',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects campaign update with an endDate earlier than today', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
      name: 'Campaign One',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    await expect(
      service.update(
        'campaign-1',
        {
          endDate: '2026-03-28T00:00:00.000Z',
        },
        {
          role: 'MANAGER',
          sub: 'manager-1',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects campaign update when endDate becomes earlier than startDate', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'campaign-1',
      ownerId: 'manager-1',
      name: 'Campaign One',
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    await expect(
      service.update(
        'campaign-1',
        {
          endDate: '2026-04-09T00:00:00.000Z',
        },
        {
          role: 'MANAGER',
          sub: 'manager-1',
        },
      ),
    ).rejects.toThrow('End date must be on or after the start date');

    expect(updateMock).not.toHaveBeenCalled();
  });
});
