import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  await app.listen(process.env.PORT ?? 4000);

  logger.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 4000}`);
}
void bootstrap();
