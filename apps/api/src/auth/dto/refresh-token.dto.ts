import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Optional when the refresh token is supplied via the HTTP-only refresh cookie.',
  })
  @IsOptional()
  @IsString()
  @IsJWT()
  @MaxLength(2048)
  refreshToken?: string;
}
