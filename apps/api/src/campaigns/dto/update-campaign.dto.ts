import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  campaignStatuses,
  type CampaignStatus,
} from '../../common/constants/campaign-statuses';

export class UpdateCampaignDto {
  @ApiPropertyOptional({ example: 'Campanha Black Friday' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  name?: string;

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
  status?: CampaignStatus;

  @ApiPropertyOptional({ example: 1500.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  budget?: number;

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.000Z',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsDateString()
  endDate?: string | null;
}
