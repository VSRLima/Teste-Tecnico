import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const username =
          configService.get<string>('REDIS_USERNAME') || undefined;
        const password =
          configService.get<string>('REDIS_PASSWORD') || undefined;
        const parsedPort = Number(configService.get<string>('REDIS_PORT'));
        const parsedDb = Number(configService.get<string>('REDIS_DB'));

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
            port: Number.isNaN(parsedPort) ? 6379 : parsedPort,
            db: Number.isNaN(parsedDb) ? 0 : parsedDb,
            username,
            password,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
