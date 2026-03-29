import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateUserDto {
  @ApiProperty({ example: 'Vinicius Reis' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'vinicius@email.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/, {
    message:
      'password must include uppercase, lowercase, number, and special character',
  })
  password: string;

  @ApiPropertyOptional({ enum: roles, example: 'USER', default: 'USER' })
  @IsOptional()
  @IsIn(roles)
  role?: Role;
}
