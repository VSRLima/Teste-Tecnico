import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'directcash-api',
      timestamp: new Date().toISOString(),
      uptimeInSeconds: Math.round(process.uptime()),
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
