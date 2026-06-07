jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    error = jest.fn();
    info = jest.fn();
    warn = jest.fn();
  },
}));
jest.mock('@weber-nexus/repository', () => ({
  InfluxConfigsRepository: class {},
  InfluxWriteQueueRepository: class {},
}));

import { InfluxdbTelemetryService } from './influxdb-telemetry.service';
import type { ControllerPollingResult } from '@weber-nexus/polling-engine';

describe('InfluxdbTelemetryService', () => {
  const config = {
    id: 1,
    host: 'http://127.0.0.1:8181',
    bucket: 'nexus',
    token: 'token',
    org: 'weber',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let fetchMock: jest.Mock;
  let configsRepository: { findActive: jest.Mock };
  let queueRepository: {
    enqueue: jest.Mock;
    findPending: jest.Mock;
    markAttempt: jest.Mock;
    delete: jest.Mock;
  };
  let service: InfluxdbTelemetryService;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    configsRepository = { findActive: jest.fn().mockResolvedValue(config) };
    queueRepository = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      findPending: jest.fn().mockResolvedValue([]),
      markAttempt: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new InfluxdbTelemetryService(
      configsRepository as never,
      queueRepository as never,
    );
  });

  it('skips writes when InfluxDB config is missing', async () => {
    configsRepository.findActive.mockResolvedValue(undefined);

    await service.writePollingResult(pollingResult());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueRepository.enqueue).not.toHaveBeenCalled();
  });

  it('writes polling results to the v2 write endpoint', async () => {
    fetchMock.mockResolvedValue(response(204));

    await service.writePollingResult(pollingResult());

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8181/api/v2/write?org=weber&bucket=nexus&precision=ns',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('sensor_readings'),
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      }),
    );
  });

  it('queues the current batch when InfluxDB rejects it', async () => {
    fetchMock.mockResolvedValue(response(500, 'nope'));

    await service.writePollingResult(pollingResult());

    expect(queueRepository.enqueue).toHaveBeenCalledWith(
      expect.stringContaining('sensor_readings'),
      'InfluxDB write failed with status 500: nope',
    );
  });

  it('drains queued batches before writing the current batch', async () => {
    queueRepository.findPending.mockResolvedValue([
      {
        id: 10,
        lineProtocol: 'sensor_readings,controller_id=1 raw_value=1i 1',
        attemptCount: 0,
        lastError: 'old',
        lastAttemptAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    fetchMock.mockResolvedValue(response(204));

    await service.writePollingResult(pollingResult());

    expect(queueRepository.delete).toHaveBeenCalledWith(10);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function response(status: number, body = ''): Response {
  return {
    status,
    text: async () => body,
  } as Response;
}

function pollingResult(): ControllerPollingResult {
  return {
    controller: {
      id: 1,
      name: 'DXM Norte',
      ipAddress: '127.0.0.1',
      pollingIntervalMs: 1000,
      isMultihop: false,
    },
    results: [
      {
        sensor: {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: 'Bomba 01',
          registers: [],
        },
        registers: [
          {
            register: {
              name: 'Vibração',
              address: 49,
              unit: 'mm/s',
            },
            rawValue: 123,
            scaledValue: 12.3,
            displayValue: 12.3,
          },
        ],
      },
    ],
    polledAt: new Date('2024-06-07T00:00:00.000Z'),
  };
}
