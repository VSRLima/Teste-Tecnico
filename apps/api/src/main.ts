import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { assertStrongSecretsOutsideTests } from './config/runtime-security';
import { AppLogger } from './observability/app-logger.service';

function getAllowedOrigins(configService: ConfigService) {
  return configService
    .get<string>(
      'ALLOWED_ORIGINS',
      'http://localhost:3000,http://127.0.0.1:3000',
    )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  assertStrongSecretsOutsideTests(process.env);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const allowedOrigins = getAllowedOrigins(configService);
  app.useLogger(app.get(AppLogger));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (configService.get('SWAGGER_ENABLED') === 'true') {
    app.use(
      ['/api/docs', '/api/docs-json', '/api/docs-yaml'],
      basicAuth({
        challenge: true,
        users: {
          [configService.getOrThrow<string>('SWAGGER_USER')]:
            configService.getOrThrow<string>('SWAGGER_PASSWORD'),
        },
      }),
    );

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('DirectCash API')
        .setDescription('API do MVP do teste técnico da DirectAds')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(configService.get<number>('PORT') ?? 3333);
}
void bootstrap();
