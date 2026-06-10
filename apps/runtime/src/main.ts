import { NestFactory } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@weber-nexus/logger';
import { AppModule } from './app.module';
import { RuntimeEnvService } from './config/runtime-env.service';
import { RuntimeExceptionFilter } from './filters/runtime-exception.filter';

const logger = new Logger('runtime/main.ts');

process.on('uncaughtException', (error) => {
  logger.error('Exceção não tratada no runtime.', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada sem tratamento no runtime.', reason);
});

async function bootstrap() {
  logger.info('Iniciando Nexus Runtime...');

  // TODO verificar se o banco do repositório está conectado
  // logger.info('SQLite iniciado');

  // await initializeInflux();

  // logger.info('Influx iniciado');

  // await startPollingEngine();

  // logger.info('Motor de coleta iniciado');

  // await startHealthServer();

  // logger.info('Servidor de saúde iniciado');

  const app = await NestFactory.create(AppModule);
  const runtimeEnv = app.get(RuntimeEnvService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.enableCors({ origin: true });
  app.useGlobalFilters(new RuntimeExceptionFilter(httpAdapterHost));
  app.enableShutdownHooks();
  await app.listen(runtimeEnv.runtimePort(), runtimeEnv.runtimeHost());
}

bootstrap().catch((error) => {
  logger.error('Falha ao iniciar o Nexus Runtime.', error);
});
