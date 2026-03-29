import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  const createMock = jest.fn();
  const deleteMock = jest.fn();
  const findManyMock = jest.fn();
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();

  const prisma = {
    user: {
      create: createMock,
      delete: deleteMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  } as unknown as PrismaService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma);
  });

  it('creates users with user as the default role', async () => {
    createMock.mockResolvedValue({ id: 'user-1' });

    await service.create({
      email: 'manager@test.com',
      name: 'Manager',
      passwordHash: 'hash',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        email: 'manager@test.com',
        name: 'Manager',
        passwordHash: 'hash',
        role: 'USER',
      },
    });
  });

  it('creates users preserving an explicit role', async () => {
    createMock.mockResolvedValue({ id: 'user-1' });

    await service.create({
      email: 'admin@test.com',
      name: 'Admin',
      passwordHash: 'hash',
      role: 'ADMIN',
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        email: 'admin@test.com',
        name: 'Admin',
        passwordHash: 'hash',
        role: 'ADMIN',
      },
    });
  });

  it('creates managed users with the provided role', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    createMock.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Managed User',
      passwordHash: 'hashed-password',
      role: Role.MANAGER,
      createdAt: new Date('2026-03-29T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T00:00:00.000Z'),
    });

    const result = await service.createManagedUser({
      email: 'user@test.com',
      name: 'Managed User',
      password: 'Admin@123',
      role: 'MANAGER',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('Admin@123', 10);
    expect(result).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Managed User',
      role: Role.MANAGER,
      createdAt: new Date('2026-03-29T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T00:00:00.000Z'),
    });
  });

  it('lists managed users ordered by createdAt and email', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@test.com',
        name: 'Managed User',
        passwordHash: 'hashed-password',
        role: Role.USER,
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        updatedAt: new Date('2026-03-29T00:00:00.000Z'),
      },
    ]);

    const result = await service.findAllManagedUsers();

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('passwordHash');
  });

  it('updates managed users', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    updateMock.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      name: 'Updated User',
      passwordHash: 'hashed-password',
      role: Role.ADMIN,
      createdAt: new Date('2026-03-29T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T01:00:00.000Z'),
    });

    const result = await service.updateManagedUser(
      'user-1',
      {
        name: 'Updated User',
        password: 'Admin@123',
        role: 'ADMIN',
      },
      'admin-1',
    );

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Updated User',
        role: 'ADMIN',
        passwordHash: 'hashed-password',
      },
    });
    expect(result.role).toBe(Role.ADMIN);
  });

  it('prevents editing the current admin account from user management', async () => {
    await expect(
      service.updateManagedUser(
        'admin-1',
        {
          role: 'MANAGER',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents deleting the current admin account from user management', async () => {
    await expect(
      service.removeManagedUser('admin-1', 'admin-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps duplicate emails to conflict on managed create', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.createManagedUser({
        email: 'dup@test.com',
        name: 'Duplicate',
        password: 'Admin@123',
        role: 'USER',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps missing users to not found on update', async () => {
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.updateManagedUser(
        'missing-user',
        {
          name: 'Updated User',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finds users by email', async () => {
    findUniqueMock.mockResolvedValue({ id: 'user-1' });

    await service.findByEmail('manager@test.com');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: 'manager@test.com' },
    });
  });

  it('finds users by id', async () => {
    findUniqueMock.mockResolvedValue({ id: 'user-1' });

    await service.findById('user-1');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('sanitizes user payloads', () => {
    expect(
      service.sanitize({
        id: 'user-1',
        name: 'Manager',
        email: 'manager@test.com',
        passwordHash: 'hash',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({
      name: 'Manager',
      role: Role.USER,
    });
  });
});
