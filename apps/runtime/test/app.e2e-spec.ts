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

  class EquipmentRepository {
    findEquipmentTypes(): Promise<unknown[]> {
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

  class MigrationHistoryRepository {
    findByKindAndVersion(): Promise<undefined> {
      return Promise.resolve(undefined);
    }

    recordResult(): Promise<void> {
      return Promise.resolve();
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
      EquipmentRepository,
      SensorsRepository,
      InfluxConfigsRepository,
      InfluxWriteQueueRepository,
      MigrationHistoryRepository,
      UsersRepository,
    ],
    exports: [
      ControllersRepository,
      EquipmentRepository,
      SensorsRepository,
      InfluxConfigsRepository,
      InfluxWriteQueueRepository,
      MigrationHistoryRepository,
      UsersRepository,
    ],
  })(RepositoryModule);

  return {
    ControllersRepository,
    DEFAULT_INFLUXDB_AUTH_TOKEN: 'test-token',
    EquipmentRepository,
    InfluxConfigsRepository,
    InfluxWriteQueueRepository,
    MigrationHistoryRepository,
    RepositoryModule,
    SensorsRepository,
    UsersRepository,
  };
});

describe('Runtime API (e2e)', () => {
  let app: INestApplication<App>;
  let originalDisableInfluxdb: string | undefined;
  let originalUpdateAgentToken: string | undefined;

  beforeEach(async () => {
    originalDisableInfluxdb = process.env.NEXUS_DISABLE_INFLUXDB;
    originalUpdateAgentToken = process.env.NEXUS_UPDATE_AGENT_TOKEN;
    process.env.NEXUS_DISABLE_INFLUXDB = '1';
    process.env.NEXUS_UPDATE_AGENT_TOKEN = 'agent-token';

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

    if (originalUpdateAgentToken === undefined) {
      delete process.env.NEXUS_UPDATE_AGENT_TOKEN;
    } else {
      process.env.NEXUS_UPDATE_AGENT_TOKEN = originalUpdateAgentToken;
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

  it('enters maintenance mode through local update channel', async () => {
    const maintenance = await request(app.getHttpServer())
      .post('/runtime/update/maintenance')
      .set('x-nexus-agent-token', 'agent-token')
      .expect(201);

    expect(maintenance.body).toMatchObject({
      status: 'maintenance',
      message: 'Runtime em modo manutenção.',
    });
    expect(Number.isNaN(Date.parse(maintenance.body.entered_at_utc))).toBe(
      false,
    );

    const status = await request(app.getHttpServer())
      .get('/runtime/update/status')
      .set('x-nexus-agent-token', 'agent-token')
      .expect(200);

    expect(status.body).toMatchObject({
      status: 'maintenance',
      polling: {
        pausedForUpdate: true,
      },
    });
  });
});
