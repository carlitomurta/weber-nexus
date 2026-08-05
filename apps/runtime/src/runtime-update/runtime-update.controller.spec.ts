import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RuntimeEnvService } from '../config/runtime-env.service';
import { InfluxdbTelemetryService } from '../influxdb/influxdb-telemetry.service';
import { PollingRuntimeService } from '../polling/polling-runtime.service';
import { RuntimeUpdateController } from './runtime-update.controller';
import { RuntimeUpdateGuard } from './runtime-update.guard';
import { RuntimeUpdateService } from './runtime-update.service';

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
}), { virtual: true });

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
    ensureDefault(): Promise<Record<string, never>> {
      return Promise.resolve({});
    }
  }

  class InfluxWriteQueueRepository {
    countPending(): Promise<number> {
      return Promise.resolve(2);
    }

    findPending(): Promise<unknown[]> {
      return Promise.resolve([]);
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
    ],
    exports: [
      ControllersRepository,
      SensorsRepository,
      InfluxConfigsRepository,
      InfluxWriteQueueRepository,
    ],
  })(RepositoryModule);

  return {
    ControllersRepository,
    InfluxConfigsRepository,
    InfluxWriteQueueRepository,
    RepositoryModule,
    SensorsRepository,
  };
});

describe('RuntimeUpdateController', () => {
  let app: INestApplication<App>;
  let originalToken: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    originalToken = process.env.NEXUS_UPDATE_AGENT_TOKEN;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NEXUS_UPDATE_AGENT_TOKEN = 'agent-token';
    process.env.NODE_ENV = 'test';

    const repository = jest.requireMock('@weber-nexus/repository') as {
      ControllersRepository: new () => unknown;
      InfluxConfigsRepository: new () => unknown;
      SensorsRepository: new () => unknown;
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RuntimeUpdateController],
      providers: [
        RuntimeEnvService,
        RuntimeUpdateGuard,
        RuntimeUpdateService,
        {
          provide: PollingRuntimeService,
          useValue: pollingRuntimeServiceMock(),
        },
        {
          provide: InfluxdbTelemetryService,
          useValue: {
            checkpointQueueForUpdate: jest.fn().mockResolvedValue({
              pendingQueueItems: 2,
              checkpointedAtUtc: '2026-08-03T12:00:00.000Z',
            }),
          },
        },
        {
          provide: repository.ControllersRepository,
          useValue: repositoryMock(),
        },
        {
          provide: repository.SensorsRepository,
          useValue: repositoryMock(),
        },
        {
          provide: repository.InfluxConfigsRepository,
          useValue: { ensureDefault: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    restoreEnv('NEXUS_UPDATE_AGENT_TOKEN', originalToken);
    restoreEnv('NODE_ENV', originalNodeEnv);
    await app.close();
  });

  it('blocks update channel without agent token', async () => {
    await request(app.getHttpServer())
      .get('/runtime/update/status')
      .expect(403);
  });

  it('prepares runtime for update with local agent token', async () => {
    const response = await request(app.getHttpServer())
      .post('/runtime/update/prepare')
      .set('x-nexus-agent-token', 'agent-token')
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'ready_for_update',
      polling_paused: true,
      pending_queue_items: 2,
    });
    expect(response.body.prepared_at_utc).toEqual(expect.any(String));
  });

  it('runs final health check and returns healthy status', async () => {
    const response = await request(app.getHttpServer())
      .post('/runtime/update/health-check')
      .set('x-nexus-agent-token', 'agent-token')
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'healthy',
      sqlite: { status: 'healthy' },
      api: { status: 'healthy' },
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function pollingRuntimeServiceMock() {
  return {
    pauseForUpdate: jest.fn(),
    resumeAfterUpdate: jest.fn().mockResolvedValue(undefined),
    health: jest.fn().mockReturnValue({
      status: 'running',
      pausedForUpdate: false,
      latestSnapshotCount: 0,
    }),
  };
}

function repositoryMock() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
  };
}
