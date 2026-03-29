import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

type SeededUser = {
  email: string;
  id: string;
  name: string;
  password: string;
  role: Role;
};

type SeededCampaign = {
  budget: number;
  description: string | null;
  endDate: Date | null;
  name: string;
  ownerId: string;
  startDate: Date;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'COMPLETED';
};

export const seededUsers: Record<
  'admin' | 'manager' | 'managerTwo',
  SeededUser
> = {
  admin: {
    id: 'admin-e2e',
    name: 'Admin',
    email: 'admin@test.com',
    password: 'Admin@123',
    role: Role.ADMIN,
  },
  manager: {
    id: 'manager-e2e',
    name: 'Manager',
    email: 'manager@test.com',
    password: 'Manager@123',
    role: Role.MANAGER,
  },
  managerTwo: {
    id: 'manager-two-e2e',
    name: 'Manager Two',
    email: 'manager2@test.com',
    password: 'Manager@123',
    role: Role.MANAGER,
  },
};

export const seededCampaigns: SeededCampaign[] = [
  {
    name: 'Campaign One',
    description: 'First campaign',
    status: 'ACTIVE',
    budget: 1000,
    startDate: new Date('2099-04-01T00:00:00.000Z'),
    endDate: new Date('2099-04-30T23:59:59.000Z'),
    ownerId: seededUsers.manager.id,
  },
  {
    name: 'Campaign Two',
    description: 'Second campaign',
    status: 'DRAFT',
    budget: 1500,
    startDate: new Date('2099-05-01T00:00:00.000Z'),
    endDate: null,
    ownerId: seededUsers.managerTwo.id,
  },
];

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Campaign", "User" RESTART IDENTITY CASCADE',
  );
}

export async function seedUsers(prisma: PrismaClient) {
  const users = await Promise.all(
    Object.values(seededUsers).map(async (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      passwordHash: await bcrypt.hash(user.password, 10),
    })),
  );

  await prisma.user.createMany({
    data: users,
  });

  return seededUsers;
}

export async function seedCampaignFixtures(prisma: PrismaClient) {
  await prisma.campaign.createMany({
    data: seededCampaigns.map((campaign) => ({
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      budget: campaign.budget,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      ownerId: campaign.ownerId,
    })),
  });
}
