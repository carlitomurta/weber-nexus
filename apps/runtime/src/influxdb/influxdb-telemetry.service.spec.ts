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
  SensorsRepository: class {},
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
  let configsRepository: { findActive: jest.Mock; ensureDefault: jest.Mock };
  let queueRepository: {
    enqueue: jest.Mock;
    findPending: jest.Mock;
    markAttempt: jest.Mock;
    delete: jest.Mock;
  };
  let sensorsRepository: { findAll: jest.Mock };
  let service: InfluxdbTelemetryService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    configsRepository = {
      findActive: jest.fn().mockResolvedValue(config),
      ensureDefault: jest.fn().mockResolvedValue(config),
    };
    queueRepository = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      findPending: jest.fn().mockResolvedValue([]),
      markAttempt: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    sensorsRepository = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 7,
          controllerId: 1,
          nodeId: 3,
          name: 'Bomba 01',
          registers: [{ name: 'Vibração', address: 49, unit: 'mm/s' }],
        },
      ]),
    };
    service = new InfluxdbTelemetryService(
      configsRepository as never,
      queueRepository as never,
      sensorsRepository as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips writes when InfluxDB config is missing', async () => {
    await service.writePollingResult(pollingResult());

    expect(configsRepository.ensureDefault).toHaveBeenCalled();
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

  it('queries recent readings from the v3 SQL endpoint', async () => {
    fetchMock.mockResolvedValue(
      response(
        200,
        JSON.stringify({
          time: '2024-06-07T00:00:00Z',
          controller_id: '1',
          sensor_id: '7',
          node_id: '3',
          register_address: '49',
          register_kind: 'metric',
          raw_value: 123,
          scaled_value: 12.3,
          unit: 'mm/s',
          controller_name: 'DXM Norte',
          sensor_name: 'Bomba 01',
          register_name: 'Vibração',
        }) + '\n',
      ),
    );

    const readings = await service.findRecentReadings();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8181/api/v3/query_sql',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"format":"jsonl"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8181/api/v3/query_sql',
      expect.objectContaining({
        body: expect.stringContaining(
          "WHERE time >= '2025-12-07T12:00:00.000Z' AND time < '2026-06-07T12:00:00.000Z'",
        ),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8181/api/v3/query_sql',
      expect.objectContaining({
        body: expect.stringContaining(
          "controller_id = '1' AND sensor_id = '7' AND register_address = '49'",
        ),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8181/api/v3/query_sql',
      expect.objectContaining({
        body: expect.stringContaining('ORDER BY time ASC'),
      }),
    );
    expect(readings).toHaveLength(1);
  });

  it('continues querying after the last timestamp when InfluxDB returns the 300 row cap', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, jsonLines(300)))
      .mockResolvedValueOnce(response(200, jsonLines(1, 300)));

    const readings = await service.findRecentReadings('2y');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readings).toHaveLength(301);
  });

  it('queries registered sensors in batches to bypass same-timestamp caps', async () => {
    sensorsRepository.findAll.mockResolvedValue([
      {
        id: 7,
        controllerId: 1,
        nodeId: 3,
        name: 'Bomba 01',
        registers: Array.from({ length: 60 }, (_, index) => ({
          name: `Register ${index}`,
          address: index + 1,
          unit: 'mm/s',
        })),
      },
    ]);
    fetchMock
      .mockResolvedValueOnce(response(200, jsonLines(100)))
      .mockResolvedValueOnce(response(200, jsonLines(100, 100)))
      .mockResolvedValueOnce(response(200, jsonLines(10, 200)));

    const readings = await service.findRecentReadings();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(readings).toHaveLength(210);
  });

  it('uses the default InfluxDB config for recent reading queries', async () => {
    fetchMock.mockResolvedValue(response(200));

    await service.findRecentReadings();

    expect(configsRepository.ensureDefault).toHaveBeenCalled();
  });
});

function response(status: number, body = ''): Response {
  return {
    status,
    text: () => Promise.resolve(body),
  } as Response;
}

function jsonLines(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, index) =>
    JSON.stringify({
      time: new Date(Date.UTC(2026, 0, 1, 0, offset + index)).toISOString(),
      controller_id: '1',
      sensor_id: '7',
      node_id: '3',
      register_address: '49',
      register_kind: 'metric',
      raw_value: 123,
      scaled_value: 12.3,
      unit: 'mm/s',
      controller_name: 'DXM Norte',
      sensor_name: 'Bomba 01',
      register_name: 'Vibração',
    }),
  ).join('\n');
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
