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
import { normalizeEmail } from '../common/utils/normalization';
import { UserRecord, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type AuthenticatedUser = JwtUser;

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = AuthTokens & {
  user: AuthenticatedUser;
};

type RefreshTokenPayload = JwtUser & {
  exp?: number;
};

const JWT_DURATION_PATTERN = /^(\d+(ms|s|m|h|d|w|y))$/;

function isJwtDuration(value: string): value is StringValue {
  return JWT_DURATION_PATTERN.test(value);
}

@Injectable()
export class AuthService {
  private readonly revokedRefreshTokens = new Map<string, number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.usersService.create({
        email: normalizedEmail,
        name: dto.name,
        passwordHash,
        role: 'USER',
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
    const user = await this.usersService.findByEmail(normalizeEmail(dto.email));
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

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user);
  }

  async revokeRefreshToken(refreshToken: string | null | undefined) {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      this.pruneRevokedRefreshTokens();
      this.revokedRefreshTokens.set(
        refreshToken,
        payload.exp ? payload.exp * 1_000 : Date.now(),
      );
    } catch {
      // Logout should still succeed even when the token is already invalid.
    }
  }

  private async buildAuthResponse(user: UserRecord): Promise<AuthResult> {
    const tokens = await this.issueTokens(user);

    return {
      ...tokens,
      user: {
        name: user.name,
        role: user.role,
        sub: user.id,
      },
    };
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

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    this.pruneRevokedRefreshTokens();

    const revokedUntil = this.revokedRefreshTokens.get(refreshToken);

    if (revokedUntil && revokedUntil > Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private pruneRevokedRefreshTokens() {
    const now = Date.now();

    for (const [token, expiresAt] of this.revokedRefreshTokens.entries()) {
      if (expiresAt <= now) {
        this.revokedRefreshTokens.delete(token);
      }
    }
  }
}
