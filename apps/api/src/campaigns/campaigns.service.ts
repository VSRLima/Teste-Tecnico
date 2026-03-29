import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus as PrismaCampaignStatus, Prisma } from '@prisma/client';
import { Role } from '../common/constants/roles';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignExpirationSchedulerService } from './campaign-expiration-scheduler.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

type CurrentUser = {
  role: Role;
  sub: string;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignExpirationSchedulerService: CampaignExpirationSchedulerService,
  ) {}

  async create(dto: CreateCampaignDto, currentUser: CurrentUser) {
    this.assertDatesAreNotInPast(dto.startDate, dto.endDate);
    this.assertDateRange(dto.startDate, dto.endDate);
    await this.ensureCampaignNameIsAvailable(dto.name, currentUser.sub);

    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status as PrismaCampaignStatus,
          budget: new Prisma.Decimal(dto.budget),
          startDate: new Date(dto.startDate),
          ...(dto.endDate && { endDate: new Date(dto.endDate) }),
          ownerId: currentUser.sub,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      });

      await this.campaignExpirationSchedulerService.refreshCampaignSchedule(
        campaign,
      );

      return campaign;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You already have a campaign with this name',
        );
      }

      throw error;
    }
  }

  async findAll(currentUser: CurrentUser) {
    return this.prisma.campaign.findMany({
      where:
        currentUser.role === 'ADMIN' ? undefined : { ownerId: currentUser.sub },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    this.assertAccess(campaign.ownerId, currentUser);
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, currentUser: CurrentUser) {
    const currentCampaign = await this.findOne(id, currentUser);
    const nextStartDate =
      dto.startDate ?? currentCampaign.startDate.toISOString();
    const nextEndDate =
      dto.endDate === undefined
        ? currentCampaign.endDate?.toISOString()
        : (dto.endDate ?? undefined);

    this.assertDatesAreNotInPast(
      dto.startDate,
      dto.endDate === null ? undefined : dto.endDate,
    );
    this.assertDateRange(nextStartDate, nextEndDate);

    if (dto.name && dto.name !== currentCampaign.name) {
      await this.ensureCampaignNameIsAvailable(
        dto.name,
        currentCampaign.ownerId,
        id,
      );
    }

    const data: Prisma.CampaignUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status !== undefined && {
        status: dto.status as PrismaCampaignStatus,
      }),
      ...(dto.budget !== undefined && {
        budget: new Prisma.Decimal(dto.budget),
      }),
      ...(dto.startDate !== undefined && {
        startDate: new Date(dto.startDate),
      }),
      ...(dto.endDate === undefined
        ? {}
        : dto.endDate === null
          ? { endDate: null }
          : { endDate: new Date(dto.endDate) }),
    };

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    await this.campaignExpirationSchedulerService.refreshCampaignSchedule(
      campaign,
    );

    return campaign;
  }

  async remove(id: string, currentUser: CurrentUser) {
    await this.findOne(id, currentUser);

    await this.prisma.campaign.delete({
      where: { id },
    });

    await this.campaignExpirationSchedulerService.unscheduleCampaignExpiration(
      id,
    );

    return {
      message: 'Campaign deleted successfully',
    };
  }

  private async ensureCampaignNameIsAvailable(
    name: string,
    ownerId: string,
    campaignIdToIgnore?: string,
  ): Promise<void> {
    const existingCampaign = await this.prisma.campaign.findFirst({
      where: {
        ownerId,
        name,
        id: campaignIdToIgnore
          ? {
              not: campaignIdToIgnore,
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existingCampaign) {
      throw new ConflictException('You already have a campaign with this name');
    }
  }

  private assertAccess(ownerId: string, currentUser: CurrentUser) {
    if (currentUser.role === 'ADMIN') {
      return;
    }

    if (ownerId !== currentUser.sub) {
      throw new ForbiddenException('You do not have access to this campaign');
    }
  }

  private assertDatesAreNotInPast(startDate?: string, endDate?: string) {
    const today = this.getStartOfToday();

    if (startDate && this.getStartOfDay(startDate) < today) {
      throw new BadRequestException('Start date cannot be earlier than today');
    }

    if (endDate && this.getStartOfDay(endDate) < today) {
      throw new BadRequestException('End date cannot be earlier than today');
    }
  }

  private assertDateRange(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) {
      return;
    }

    if (this.getStartOfDay(endDate) < this.getStartOfDay(startDate)) {
      throw new BadRequestException(
        'End date must be on or after the start date',
      );
    }
  }

  private getStartOfToday() {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private getStartOfDay(value: string) {
    const date = new Date(value);

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
