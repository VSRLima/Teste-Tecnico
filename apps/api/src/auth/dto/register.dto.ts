import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normalizeDisplayText,
  normalizeEmail,
} from '../../common/utils/normalization';

export class RegisterDto {
  @ApiProperty({ example: 'Vinicius Reis' })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? normalizeDisplayText(value) : value,
  )
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'vinicius@email.com' })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
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
}
