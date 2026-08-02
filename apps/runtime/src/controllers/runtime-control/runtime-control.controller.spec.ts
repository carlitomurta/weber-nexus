import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RuntimeControlModule } from './runtime-control.module';

describe('RuntimeControlController', () => {
  let app: INestApplication<App>;
  let originalRuntimeStop: string | undefined;

  beforeEach(async () => {
    originalRuntimeStop = process.env.NEXUS_ENABLE_RUNTIME_STOP;
    process.env.NEXUS_ENABLE_RUNTIME_STOP = '1';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RuntimeControlModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalRuntimeStop === undefined) {
      delete process.env.NEXUS_ENABLE_RUNTIME_STOP;
    } else {
      process.env.NEXUS_ENABLE_RUNTIME_STOP = originalRuntimeStop;
    }
    await app.close();
  });

  it('returns runtime health status', async () => {
    const response = await request(app.getHttpServer())
      .get('/runtime/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ready' });
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('returns response before stopping runtime', async () => {
    jest.useFakeTimers();
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);

    const response = await request(app.getHttpServer())
      .post('/runtime/stop')
      .expect(201);

    expect(response.body).toEqual({ stopping: true });
    expect(killSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(250);

    expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
  });

  it('blocks runtime stop when local development stop is disabled', async () => {
    process.env.NEXUS_ENABLE_RUNTIME_STOP = '0';

    await request(app.getHttpServer()).post('/runtime/stop').expect(403);
  });
});
