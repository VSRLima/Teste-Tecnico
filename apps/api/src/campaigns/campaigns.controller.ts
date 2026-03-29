import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../common/interfaces/jwt-user.interface';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  create(
    @Body() dto: CreateCampaignDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.campaignsService.create(dto, request.user);
  }

  @Get()
  @ApiOperation({
    summary: 'List campaigns available to the authenticated user',
  })
  findAll(@Req() request: Request & { user: JwtUser }) {
    return this.campaignsService.findAll(request.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by id' })
  findOne(
    @Param('id') id: string,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.campaignsService.findOne(id, request.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign by id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.campaignsService.update(id, dto, request.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campaign by id' })
  remove(@Param('id') id: string, @Req() request: Request & { user: JwtUser }) {
    return this.campaignsService.remove(id, request.user);
  }
}
