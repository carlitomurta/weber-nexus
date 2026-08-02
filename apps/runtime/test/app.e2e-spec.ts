import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.mock('@weber-nexus/logger', () => ({
  Logger: class Logger {
    info(): void {}
    warn(): void {}
    error(): void {}
  },
}));

jest.mock('@weber-nexus/polling-engine', () => ({
  PollingEngine: class PollingEngine {
    startController(): void {}
    stopController(): void {}
    stop(): void {}
  },
}));

jest.mock('@weber-nexus/repository', () => {
  const { Global, Module } =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');

  class ControllersRepository {
    findAll(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }

  class SensorsRepository {
    findAll(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }

  class InfluxConfigsRepository {
    ensureDefault(): Promise<{ token: string; bucket: string }> {
      return Promise.resolve({
        token: 'test-token',
        bucket: 'test-bucket',
      });
    }
  }

  class InfluxWriteQueueRepository {
    findPending(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }

  class UsersRepository {
    ensureDefaultAdmin(): Promise<void> {
      return Promise.resolve();
    }
  }

  class RepositoryModule {}

  Global()(RepositoryModule);
  Module({
    providers: [
      ControllersRepository,
      SensorsRepository,
      InfluxConfigsRepository,
      InfluxWriteQueueRepository,
      UsersRepository,
    ],
    exports: [
      ControllersRepository,
      SensorsRepository,
      InfluxConfigsRepository,
      InfluxWriteQueueRepository,
      UsersRepository,
    ],
  })(RepositoryModule);

  return {
    ControllersRepository,
    DEFAULT_INFLUXDB_AUTH_TOKEN: 'test-token',
    InfluxConfigsRepository,
    InfluxWriteQueueRepository,
    RepositoryModule,
    SensorsRepository,
    UsersRepository,
  };
});

describe('Runtime API (e2e)', () => {
  let app: INestApplication<App>;
  let originalDisableInfluxdb: string | undefined;

  beforeEach(async () => {
    originalDisableInfluxdb = process.env.NEXUS_DISABLE_INFLUXDB;
    process.env.NEXUS_DISABLE_INFLUXDB = '1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (originalDisableInfluxdb === undefined) {
      delete process.env.NEXUS_DISABLE_INFLUXDB;
    } else {
      process.env.NEXUS_DISABLE_INFLUXDB = originalDisableInfluxdb;
    }

    await app?.close();
  });

  it('returns runtime health status', async () => {
    const response = await request(app.getHttpServer())
      .get('/runtime/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ready' });
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
