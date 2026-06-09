import { NestFactory } from '@nestjs/core';
import { Logger } from '@weber-nexus/logger';
import { AppModule } from './app.module';
import { RuntimeEnvService } from './config/runtime-env.service';

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
  const runtimeEnv = app.get(RuntimeEnvService);

  app.enableCors({ origin: true });
  app.enableShutdownHooks();
  await app.listen(runtimeEnv.runtimePort(), runtimeEnv.runtimeHost());
}

bootstrap().catch((error) => {
  logger.error('Nexus Runtime failed to start.', error);
  process.exit(1);
});
