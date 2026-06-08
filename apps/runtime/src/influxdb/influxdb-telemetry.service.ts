import { Injectable } from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import type { ControllerPollingResult } from '@weber-nexus/polling-engine';
import {
  InfluxConfigsRepository,
  InfluxWriteQueueRepository,
  SensorsRepository,
  type InfluxConfig,
  type Sensor,
} from '@weber-nexus/repository';
import type { InfluxSensorReading } from './influxdb-telemetry.schema';
import { buildSensorReadingsLineProtocol } from './influxdb-telemetry.schema';

const WRITE_TIMEOUT_MS = 3000;
const QUEUE_DRAIN_LIMIT = 25;
const INFLUX_QUERY_RESULT_CAP = 300;
const QUERY_REGISTER_BATCH_SIZE = 25;

export type InfluxReadingsRange = '2y' | '6m' | '1w';

@Injectable()
export class InfluxdbTelemetryService {
  private readonly logger = new Logger('runtime/influxdb-telemetry.service.ts');

  constructor(
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly influxWriteQueueRepository: InfluxWriteQueueRepository,
    private readonly sensorsRepository: SensorsRepository,
  ) {}

  async writePollingResult(result: ControllerPollingResult): Promise<void> {
    const config = await this.influxConfigsRepository.ensureDefault();

    const lineProtocol = buildSensorReadingsLineProtocol(result);
    if (!lineProtocol) return;

    await this.drainQueue(config);

    try {
      await this.writeLineProtocol(config, lineProtocol);
    } catch (error) {
      const message = errorMessage(error);

      await this.influxWriteQueueRepository.enqueue(lineProtocol, message);
      this.logger.error('Failed to write telemetry to InfluxDB.', error);
    }
  }

  async findRecentReadings(
    range: InfluxReadingsRange = '6m',
  ): Promise<InfluxSensorReading[]> {
    const config = await this.influxConfigsRepository.ensureDefault();
    const end = new Date();
    const start = startDateForRange(range, end);
    const batches = registerBatches(await this.sensorsRepository.findAll());

    if (batches.length === 0) {
      return [];
    }

    this.logger.info(
      `Querying InfluxDB readings range=${range} batches=${batches.length} format=jsonl`,
    );

    const readings: InfluxSensorReading[] = [];

    for (const batch of batches) {
      readings.push(...(await this.queryReadings(config, start, end, batch)));
    }

    return readings.sort(
      (left, right) =>
        new Date(left.time).getTime() - new Date(right.time).getTime(),
    );
  }

  private async drainQueue(config: InfluxConfig): Promise<void> {
    const pending =
      await this.influxWriteQueueRepository.findPending(QUEUE_DRAIN_LIMIT);

    for (const item of pending) {
      try {
        await this.writeLineProtocol(config, item.lineProtocol);
        await this.influxWriteQueueRepository.delete(item.id);
      } catch (error) {
        await this.influxWriteQueueRepository.markAttempt(
          item.id,
          item.attemptCount + 1,
          errorMessage(error),
        );
        this.logger.warn(
          `Queued InfluxDB telemetry batch ${item.id} was not written.`,
          error,
        );
        return;
      }
    }
  }

  private async writeLineProtocol(
    config: InfluxConfig,
    lineProtocol: string,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

    try {
      const response = await fetch(buildWriteUrl(config), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: lineProtocol,
        signal: controller.signal,
      });

      if (response.status !== 204) {
        const responseText = await response.text();
        throw new Error(
          `InfluxDB write failed with status ${response.status}: ${responseText}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async queryReadings(
    config: InfluxConfig,
    start: Date,
    end: Date,
    registers: ReadingRegister[],
  ): Promise<InfluxSensorReading[]> {
    const readings: InfluxSensorReading[] = [];
    let cursor = start;

    while (cursor < end) {
      const page = await this.queryReadingsRange(
        config,
        cursor,
        end,
        registers,
      );

      readings.push(...page);

      if (page.length < INFLUX_QUERY_RESULT_CAP) {
        return readings;
      }

      const nextCursor = cursorAfter(page);

      if (!nextCursor || nextCursor <= cursor) {
        this.logger.warn('InfluxDB reading query pagination stalled.');
        return readings;
      }

      cursor = nextCursor;
    }

    return readings;
  }

  private async queryReadingsRange(
    config: InfluxConfig,
    start: Date,
    end: Date,
    registers: ReadingRegister[],
  ): Promise<InfluxSensorReading[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

    try {
      const response = await fetch(buildQueryUrl(config), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          db: config.bucket,
          format: 'jsonl',
          q: buildReadingsQuery(start, end, registers),
        }),
        signal: controller.signal,
      });

      if (response.status !== 200) {
        const responseText = await response.text();
        throw new Error(
          `InfluxDB query failed with status ${response.status}: ${responseText}`,
        );
      }

      return parseJsonLines(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildWriteUrl(config: InfluxConfig): string {
  const url = new URL('/api/v2/write', normalizeHost(config.host));

  url.searchParams.set('org', config.org);
  url.searchParams.set('bucket', config.bucket);
  url.searchParams.set('precision', 'ns');

  return url.toString();
}

function buildQueryUrl(config: InfluxConfig): string {
  return new URL('/api/v3/query_sql', normalizeHost(config.host)).toString();
}

type ReadingRegister = {
  controllerId: number;
  sensorId: number;
  registerAddress: number;
};

function buildReadingsQuery(
  start: Date,
  end: Date,
  registers: ReadingRegister[],
): string {
  return `SELECT time, controller_id, sensor_id, node_id, register_address, register_kind, raw_value, scaled_value, unit, health_state_code, online, status_text, controller_name, sensor_name, register_name FROM sensor_readings WHERE time >= '${start.toISOString()}' AND time < '${end.toISOString()}' AND (${registerWhereClause(registers)}) ORDER BY time ASC`;
}

function registerWhereClause(registers: ReadingRegister[]): string {
  return registers
    .map(
      (register) =>
        `(controller_id = '${sqlString(register.controllerId)}' AND sensor_id = '${sqlString(register.sensorId)}' AND register_address = '${sqlString(register.registerAddress)}')`,
    )
    .join(' OR ');
}

function registerBatches(sensors: Sensor[]): ReadingRegister[][] {
  const registers = sensors.flatMap((sensor) =>
    sensor.registers
      .filter((register) => !register.isHealthCheck)
      .map((register) => ({
        controllerId: sensor.controllerId,
        sensorId: sensor.id,
        registerAddress: register.address,
      })),
  );

  return chunk(registers, QUERY_REGISTER_BATCH_SIZE);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function startDateForRange(range: InfluxReadingsRange, end: Date): Date {
  const start = new Date(end);

  if (range === '2y') {
    start.setUTCFullYear(start.getUTCFullYear() - 2);
    return start;
  }

  if (range === '1w') {
    start.setUTCDate(start.getUTCDate() - 7);
    return start;
  }

  start.setUTCMonth(start.getUTCMonth() - 6);
  return start;
}

function sqlString(value: string | number): string {
  return String(value).replaceAll("'", "''");
}

function cursorAfter(readings: InfluxSensorReading[]): Date | undefined {
  const lastReading = readings.at(-1);
  if (!lastReading) return undefined;

  const lastTime = new Date(lastReading.time).getTime();
  if (!Number.isFinite(lastTime)) return undefined;

  return new Date(lastTime + 1);
}

function parseJsonLines(body: string): InfluxSensorReading[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as InfluxSensorReading);
}

function normalizeHost(host: string): string {
  return host.endsWith('/') ? host : `${host}/`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
