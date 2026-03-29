import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { campaignStatuses } from '../../common/constants/campaign-statuses';
import type { CampaignStatus } from '../../common/constants/campaign-statuses';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Campanha Black Friday' })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({
    example: 'Campanha focada em acquisition para e-commerce.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: campaignStatuses, example: 'DRAFT' })
  @IsOptional()
  @IsIn(campaignStatuses)
  status: CampaignStatus = 'DRAFT';

  @ApiProperty({ example: 1500.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  budget: number;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
