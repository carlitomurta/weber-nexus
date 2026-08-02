import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import type { ControllerPollingResult } from '@weber-nexus/polling-engine';
import {
  InfluxConfigsRepository,
  InfluxWriteQueueRepository,
  SensorsRepository,
  type InfluxConfig,
  type InfluxWriteQueueItem,
} from '@weber-nexus/repository';
import type { InfluxSensorReading } from './influxdb-telemetry.schema';
import { buildSensorReadingsLineProtocol } from './influxdb-telemetry.schema';
import { InfluxdbTelemetryRepository } from './influxdb-telemetry.repository';
import {
  buildReadingRegisterBatches,
  buildSensorReadingsSql,
  type ReadingRegister,
} from './sql/sensor-readings.sql';

const QUEUE_DRAIN_LIMIT = 25;
const QUEUE_DRAIN_INTERVAL_MS = 30_000;
const QUEUE_RETRY_INITIAL_DELAY_MS = 5_000;
const QUEUE_RETRY_MAX_DELAY_MS = 300_000;
const INFLUX_QUERY_RESULT_CAP = 300;
const QUERY_REGISTER_BATCH_SIZE = 25;

export type InfluxReadingsRange = '2y' | '1y' | '6m' | '1w';

@Injectable()
export class InfluxdbTelemetryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('runtime/influxdb-telemetry.service.ts');
  private queueDrainTimer: NodeJS.Timeout | undefined;
  private queueDrainRunning = false;

  constructor(
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly influxWriteQueueRepository: InfluxWriteQueueRepository,
    private readonly sensorsRepository: SensorsRepository,
    private readonly telemetryRepository: InfluxdbTelemetryRepository,
  ) {}

  onApplicationBootstrap(): void {
    void this.drainQueueWithDefaultConfig();
    this.queueDrainTimer = setInterval(
      () => void this.drainQueueWithDefaultConfig(),
      QUEUE_DRAIN_INTERVAL_MS,
    );
    this.queueDrainTimer.unref();
  }

  onApplicationShutdown(): void {
    if (!this.queueDrainTimer) return;

    clearInterval(this.queueDrainTimer);
    this.queueDrainTimer = undefined;
  }

  async writePollingResult(result: ControllerPollingResult): Promise<void> {
    const config = await this.influxConfigsRepository.ensureDefault();

    const lineProtocol = buildSensorReadingsLineProtocol(result);
    if (!lineProtocol) return;

    await this.drainQueue(config);

    try {
      await this.telemetryRepository.writeLineProtocol(config, lineProtocol);
    } catch (error) {
      const message = errorMessage(error);

      await this.influxWriteQueueRepository.enqueue(lineProtocol, message);
      this.logger.error('Falha ao gravar telemetria no InfluxDB.', error);
    }
  }

  async findRecentReadings(
    range: InfluxReadingsRange = '6m',
    controllerId?: number,
    includeHealth = false,
  ): Promise<InfluxSensorReading[]> {
    const config = await this.influxConfigsRepository.ensureDefault();
    const end = new Date();
    const start = startDateForRange(range, end);
    const batches = buildReadingRegisterBatches(
      controllerId === undefined
        ? await this.sensorsRepository.findAll()
        : await this.sensorsRepository.findByControllerId(controllerId),
      QUERY_REGISTER_BATCH_SIZE,
      { includeHealth },
    );

    if (batches.length === 0) {
      return [];
    }

    this.logger.info(
      `Consultando leituras do InfluxDB intervalo=${range} controlador=${controllerId ?? 'todos'} lotes=${batches.length} formato=jsonl`,
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
    if (this.queueDrainRunning) return;

    this.queueDrainRunning = true;

    try {
      await this.drainQueueItems(config);
    } finally {
      this.queueDrainRunning = false;
    }
  }

  private async drainQueueWithDefaultConfig(): Promise<void> {
    try {
      await this.drainQueue(await this.influxConfigsRepository.ensureDefault());
    } catch (error) {
      this.logger.warn('Fila de telemetria não pôde ser drenada.', error);
    }
  }

  private async drainQueueItems(config: InfluxConfig): Promise<void> {
    const pending =
      await this.influxWriteQueueRepository.findPending(QUEUE_DRAIN_LIMIT);

    for (const item of pending) {
      if (!isQueueItemReady(item, new Date())) {
        continue;
      }

      try {
        await this.telemetryRepository.writeLineProtocol(
          config,
          item.lineProtocol,
        );
        await this.influxWriteQueueRepository.delete(item.id);
      } catch (error) {
        await this.influxWriteQueueRepository.markAttempt(
          item.id,
          item.attemptCount + 1,
          errorMessage(error),
        );
        this.logger.warn(
          `Lote de telemetria em fila ${item.id} não foi gravado no InfluxDB.`,
          error,
        );
        return;
      }
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
      const page = await this.telemetryRepository.querySensorReadings(
        config,
        buildSensorReadingsSql({
          start: cursor,
          end,
          registers,
        }),
      );

      readings.push(...page);

      if (page.length < INFLUX_QUERY_RESULT_CAP) {
        return readings;
      }

      const nextCursor = cursorAfter(page);

      if (!nextCursor || nextCursor <= cursor) {
        this.logger.warn(
          'Paginação da consulta de leituras do InfluxDB travou.',
        );
        return readings;
      }

      cursor = nextCursor;
    }

    return readings;
  }
}

function startDateForRange(range: InfluxReadingsRange, end: Date): Date {
  const start = new Date(end);

  if (range === '2y') {
    start.setUTCFullYear(start.getUTCFullYear() - 2);
    return start;
  }

  if (range === '1y') {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
    return start;
  }

  if (range === '1w') {
    start.setUTCDate(start.getUTCDate() - 7);
    return start;
  }

  start.setUTCMonth(start.getUTCMonth() - 6);
  return start;
}

function cursorAfter(readings: InfluxSensorReading[]): Date | undefined {
  const lastReading = readings.at(-1);
  if (!lastReading) return undefined;

  const lastTime = new Date(lastReading.time).getTime();
  if (!Number.isFinite(lastTime)) return undefined;

  return new Date(lastTime + 1);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQueueItemReady(item: InfluxWriteQueueItem, now: Date): boolean {
  if (item.attemptCount <= 0 || !item.lastAttemptAt) return true;

  const retryDelay = Math.min(
    QUEUE_RETRY_INITIAL_DELAY_MS * 2 ** (item.attemptCount - 1),
    QUEUE_RETRY_MAX_DELAY_MS,
  );

  return now.getTime() - item.lastAttemptAt.getTime() >= retryDelay;
}
