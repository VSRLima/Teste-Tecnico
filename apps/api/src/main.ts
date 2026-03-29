import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { AppLogger } from './observability/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  app.useLogger(app.get(AppLogger));

  app.enableCors({
    origin: true,
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
      ['/api/docs', '/api/docs-json'],
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
