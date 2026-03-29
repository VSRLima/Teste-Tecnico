import { Injectable } from '@nestjs/common';
import { Role as PrismaRole, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/constants/roles';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
};

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
        role: (data.role ?? 'MANAGER') as PrismaRole,
      },
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  sanitize(user: UserRecord | User) {
    return {
      name: user.name,
      role: user.role,
    };
  }
}
