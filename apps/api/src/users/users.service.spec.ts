import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const createMock = jest.fn();
  const findUniqueMock = jest.fn();

  const prisma = {
    user: {
      create: createMock,
      findUnique: findUniqueMock,
    },
  } as unknown as PrismaService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma);
  });

  it('creates users with manager as the default role', async () => {
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
        role: 'MANAGER',
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
        role: Role.MANAGER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual({
      name: 'Manager',
      role: Role.MANAGER,
    });
  });
});
