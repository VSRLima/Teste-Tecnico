import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const signAsyncMock = jest.fn();
  const verifyAsyncMock = jest.fn();
  const createMock = jest.fn();
  const findByEmailMock = jest.fn();
  const findByIdMock = jest.fn();
  const getMock = jest.fn();
  const getOrThrowMock = jest.fn();

  const jwtService = {
    signAsync: signAsyncMock,
    verifyAsync: verifyAsyncMock,
  } as unknown as JwtService;

  const usersService = {
    create: createMock,
    findByEmail: findByEmailMock,
    findById: findByIdMock,
  } as unknown as UsersService;

  const configService = {
    get: getMock,
    getOrThrow: getOrThrowMock,
  } as unknown as ConfigService;

  let service: AuthService;

  const user: User = {
    id: 'user-1',
    email: 'manager@test.com',
    name: 'Manager',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(jwtService, usersService, configService);
    signAsyncMock.mockImplementation(
      async (_payload, options?: { secret?: string }) =>
        options?.secret ? 'signed-refresh-token' : 'signed-access-token',
    );
    getMock.mockImplementation((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        JWT_REFRESH_EXPIRES_IN: '7d',
      };

      return values[key] ?? defaultValue;
    });
    getOrThrowMock.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        FAKE_PASSWORD_HASH:
          '$2b$10$C6UzMDM.H6dfI/f/IKcEe.O8U9U2D2Q0JqA2nU5v98d.6QG3Vq9KG',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };

      return values[key];
    });
  });

  it('registers a user account and returns session tokens', async () => {
    findByEmailMock.mockResolvedValue(null);
    createMock.mockResolvedValue(user);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const result = await service.register({
      email: 'manager@test.com',
      name: 'Manager',
      password: '12345678Aa!',
    });

    expect(createMock).toHaveBeenNthCalledWith(1, {
      email: 'manager@test.com',
      name: 'Manager',
      passwordHash: 'hashed-password',
      role: 'USER',
    });
    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: 'signed-refresh-token',
    });
    expect(signAsyncMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Manager',
        role: 'USER',
        sub: 'user-1',
      }),
    );
  });

  it('blocks duplicate registration', async () => {
    findByEmailMock.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.register({
        email: 'manager@test.com',
        name: 'Manager',
        password: '12345678Aa!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps prisma duplicate registration errors to conflict', async () => {
    findByEmailMock.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.register({
        email: 'manager@test.com',
        name: 'Manager',
        password: '12345678Aa!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores client-supplied elevated roles during registration', async () => {
    findByEmailMock.mockResolvedValue(null);
    createMock.mockResolvedValue({
      ...user,
      role: Role.USER,
    } satisfies User);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    await service.register({
      email: 'admin@test.com',
      name: 'Admin',
      password: 'Str0ngP@ssw0rd!',
    });

    expect(createMock).toHaveBeenNthCalledWith(1, {
      email: 'admin@test.com',
      name: 'Admin',
      passwordHash: 'hashed-password',
      role: 'USER',
    });
  });

  it('authenticates valid credentials', async () => {
    findByEmailMock.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'manager@test.com',
      password: '12345678Aa!',
    });

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe('signed-refresh-token');
    expect(signAsyncMock).toHaveBeenCalledTimes(2);
    expect(signAsyncMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Manager',
        role: 'USER',
        sub: 'user-1',
      }),
    );
  });

  it('rejects invalid credentials', async () => {
    findByEmailMock.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'manager@test.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still runs compare when user does not exist', async () => {
    findByEmailMock.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'missing@test.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'wrong-password',
      getOrThrowMock('FAKE_PASSWORD_HASH'),
    );
  });

  it('refreshes tokens when the refresh token is valid and the user exists', async () => {
    verifyAsyncMock.mockResolvedValue({
      role: 'USER',
      sub: 'user-1',
    });
    findByIdMock.mockResolvedValue(user);

    const result = await service.refresh({
      refreshToken: 'valid.refresh.token',
    });

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: 'signed-refresh-token',
    });
  });

  it('rejects refresh tokens for users that no longer exist', async () => {
    verifyAsyncMock.mockResolvedValue({
      role: 'USER',
      sub: 'user-1',
    });
    findByIdMock.mockResolvedValue(null);

    await expect(
      service.refresh({
        refreshToken: 'missing-user.refresh.token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid refresh tokens', async () => {
    verifyAsyncMock.mockRejectedValue(new Error('invalid token'));

    await expect(
      service.refresh({
        refreshToken: 'invalid.refresh.token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid refresh token duration configuration', async () => {
    findByEmailMock.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    getOrThrowMock.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        FAKE_PASSWORD_HASH:
          '$2b$10$C6UzMDM.H6dfI/f/IKcEe.O8U9U2D2Q0JqA2nU5v98d.6QG3Vq9KG',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: 'seven-days',
      };

      return values[key];
    });

    await expect(
      service.login({
        email: 'manager@test.com',
        password: '12345678Aa!',
      }),
    ).rejects.toThrow('Invalid JWT_REFRESH_EXPIRES_IN value');
  });
});
