import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { type StringValue } from 'ms';
import { JwtUser } from '../common/interfaces/jwt-user.interface';
import { UserRecord, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const JWT_DURATION_PATTERN = /^(\d+(ms|s|m|h|d|w|y))$/;

function isJwtDuration(value: string): value is StringValue {
  return JWT_DURATION_PATTERN.test(value);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const desiredRole = dto.role ?? 'MANAGER';
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.usersService.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: desiredRole,
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ??
        this.configService.getOrThrow<string>('FAKE_PASSWORD_HASH'),
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: UserRecord) {
    return this.issueTokens(user);
  }

  private async issueTokens(user: UserRecord): Promise<AuthTokens> {
    const payload: JwtUser = {
      name: user.name,
      sub: user.id,
      role: user.role,
    };
    const refreshExpiresIn = this.getRefreshTokenExpiresIn();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private getRefreshTokenExpiresIn(): StringValue {
    const expiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    if (!isJwtDuration(expiresIn)) {
      throw new Error(
        `Invalid JWT_REFRESH_EXPIRES_IN value: ${expiresIn}. Expected a duration like 7d or 12h.`,
      );
    }

    return expiresIn;
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtUser> {
    try {
      return await this.jwtService.verifyAsync<JwtUser>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
