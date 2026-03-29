import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { roles, type Role } from '../../common/constants/roles';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Vinicius Reis' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ example: 'vinicius@email.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: 'P@ssw0rd!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/, {
    message:
      'password must include uppercase, lowercase, number, and special character',
  })
  password?: string;

  @ApiPropertyOptional({ enum: roles, example: 'MANAGER' })
  @IsOptional()
  @IsIn(roles)
  role?: Role;
}
