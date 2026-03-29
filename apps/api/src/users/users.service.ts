import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  normalizeDisplayText,
  normalizeEmail,
} from '../common/utils/normalization';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/constants/roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
};

type PublicUserRecord = Omit<UserRecord, 'passwordHash'>;

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: PrismaRole;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserInput): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        ...data,
        email: normalizeEmail(data.email),
        name: normalizeDisplayText(data.name),
        role: (data.role ?? 'USER') as PrismaRole,
      },
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createManagedUser(dto: CreateUserDto): Promise<PublicUserRecord> {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? 'USER',
      });

      return this.toPublicUser(user);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findAllManagedUsers(): Promise<PublicUserRecord[]> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async updateManagedUser(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
  ): Promise<PublicUserRecord> {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'You cannot edit your own account from user management',
      );
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.name !== undefined && { name: normalizeDisplayText(dto.name) }),
      ...(dto.email !== undefined && { email: normalizeEmail(dto.email) }),
      ...(dto.role !== undefined && { role: dto.role as PrismaRole }),
      ...(dto.password !== undefined && {
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    };

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      return this.toPublicUser(user);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async removeManagedUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'You cannot delete your own account from user management',
      );
    }

    try {
      await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      this.handleWriteError(error, {
        foreignKey:
          'Cannot delete a user that still owns campaigns. Transfer or delete the campaigns first.',
      });
    }

    return {
      message: 'User deleted successfully',
    };
  }

  sanitize(user: UserRecord | User) {
    return {
      name: user.name,
      role: user.role,
    };
  }

  private toPublicUser(user: UserRecord | User): PublicUserRecord {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private handleWriteError(
    error: unknown,
    messages?: {
      foreignKey?: string;
    },
  ): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }

      if (error.code === 'P2003') {
        throw new ConflictException(
          messages?.foreignKey ?? 'User cannot be deleted because it is in use',
        );
      }
    }

    throw error;
  }
}
