import { NestFactory } from '@nestjs/core';
import { Logger } from '@weber-nexus/logger';
import { AppModule } from './app.module';

const logger = new Logger('runtime/main.ts');

async function bootstrap() {
  logger.info('Starting Nexus Runtime...');

  // TODO check if repository database is connected
  // logger.info('SQLite initialized');

  // await initializeInflux();

  // logger.info('Influx initialized');

  // await startPollingEngine();

  // logger.info('Polling engine initialized');

  // await startHealthServer();

  // logger.info('Health server initialized');

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
