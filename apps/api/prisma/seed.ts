import { CampaignStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const allowProductionSeed = process.env.ALLOW_PRODUCTION_SEED === 'true';

function getSeedPassword(
  environmentVariable: 'SEED_ADMIN_PASSWORD' | 'SEED_MANAGER_PASSWORD',
  fallback: string,
) {
  const value = process.env[environmentVariable];

  if (value) {
    return value;
  }

  if (isProduction) {
    throw new Error(
      `${environmentVariable} is required when NODE_ENV=production`,
    );
  }

  return fallback;
}

async function main() {
  const adminPassword = getSeedPassword('SEED_ADMIN_PASSWORD', 'Admin@123');
  const managerPassword = getSeedPassword(
    'SEED_MANAGER_PASSWORD',
    'Manager@123',
  );
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const managerPasswordHash = await bcrypt.hash(managerPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@directcash.local' },
    update: {
      name: 'DirectCash Admin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    create: {
      name: 'DirectCash Admin',
      email: 'admin@directcash.local',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@directcash.local' },
    update: {
      name: 'Campaign Manager',
      passwordHash: managerPasswordHash,
      role: Role.MANAGER,
    },
    create: {
      name: 'Campaign Manager',
      email: 'manager@directcash.local',
      passwordHash: managerPasswordHash,
      role: Role.MANAGER,
    },
  });

  await prisma.campaign.deleteMany({
    where: {
      ownerId: {
        in: [admin.id, manager.id],
      },
    },
  });

  await prisma.campaign.createMany({
    data: [
      {
        name: 'Retargeting Q2',
        description: 'Campanha focada em recuperação de carrinho e recompra.',
        status: CampaignStatus.ACTIVE,
        budget: 3200,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-04-30T23:59:59.000Z'),
        ownerId: admin.id,
      },
      {
        name: 'Leads SMB Brasil',
        description:
          'Aquisição de leads para segmento SMB com criativos dinâmicos.',
        status: CampaignStatus.DRAFT,
        budget: 1800,
        startDate: new Date('2026-04-05T00:00:00.000Z'),
        endDate: null,
        ownerId: manager.id,
      },
    ],
  });

  console.log('Seed concluída.');
  console.log('Admin: admin@directcash.local');
  console.log('Manager: manager@directcash.local');
}

if (isProduction && !allowProductionSeed) {
  console.error('Refusing to run seed in production.');
  process.exit(1);
}

void main()
  .catch((error: unknown) => {
    console.error('Falha ao executar seed.', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
