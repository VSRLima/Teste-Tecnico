import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '../../common/utils/normalization';

export class LoginDto {
  @ApiProperty({ example: 'vinicius@email.com' })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Str0ngP@ssw0rd!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
