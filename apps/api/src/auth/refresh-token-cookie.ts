import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

const REFRESH_TOKEN_COOKIE = 'directcash.refresh_token';
const JWT_DURATION_PATTERN = /^(\d+)(ms|s|m|h|d|w|y)$/;

function parseJwtDurationToMilliseconds(value: string) {
  const match = JWT_DURATION_PATTERN.exec(value);

  if (!match) {
    throw new Error(
      `Invalid JWT_REFRESH_EXPIRES_IN value: ${value}. Expected a duration like 7d or 12h.`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1_000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    case 'w':
      return amount * 604_800_000;
    case 'y':
      return amount * 31_536_000_000;
    default:
      throw new Error(
        `Invalid JWT_REFRESH_EXPIRES_IN value: ${value}. Expected a duration like 7d or 12h.`,
      );
  }
}

function buildRefreshTokenCookieOptions(configService: ConfigService) {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const maxAge = parseJwtDurationToMilliseconds(
    configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
  );

  return {
    httpOnly: true,
    maxAge,
    path: '/api/auth',
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  } as const;
}

export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  configService: ConfigService,
) {
  response.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    buildRefreshTokenCookieOptions(configService),
  );
}

export function clearRefreshTokenCookie(
  response: Response,
  configService: ConfigService,
) {
  response.clearCookie(
    REFRESH_TOKEN_COOKIE,
    buildRefreshTokenCookieOptions(configService),
  );
}

export function extractRefreshTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

  if (!cookie) {
    return null;
  }

  const separatorIndex = cookie.indexOf('=');

  if (separatorIndex === -1) {
    return null;
  }

  const token = cookie.slice(separatorIndex + 1);
  return token ? decodeURIComponent(token) : null;
}
