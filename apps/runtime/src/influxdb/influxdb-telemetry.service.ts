import { Injectable } from '@nestjs/common';
import { Logger } from '@weber-nexus/logger';
import type { ControllerPollingResult } from '@weber-nexus/polling-engine';
import {
  InfluxConfigsRepository,
  InfluxWriteQueueRepository,
  type InfluxConfig,
} from '@weber-nexus/repository';
import { buildSensorReadingsLineProtocol } from './influxdb-telemetry.schema';

const WRITE_TIMEOUT_MS = 3000;
const QUEUE_DRAIN_LIMIT = 25;

@Injectable()
export class InfluxdbTelemetryService {
  private readonly logger = new Logger('runtime/influxdb-telemetry.service.ts');

  constructor(
    private readonly influxConfigsRepository: InfluxConfigsRepository,
    private readonly influxWriteQueueRepository: InfluxWriteQueueRepository,
  ) {}

  async writePollingResult(result: ControllerPollingResult): Promise<void> {
    const config = await this.influxConfigsRepository.findActive();

    if (!config) {
      this.logger.warn(
        'InfluxDB config was not found. Telemetry write skipped.',
      );
      return;
    }

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
}

function buildWriteUrl(config: InfluxConfig): string {
  const url = new URL('/api/v2/write', normalizeHost(config.host));

  url.searchParams.set('org', config.org);
  url.searchParams.set('bucket', config.bucket);
  url.searchParams.set('precision', 'ns');

  return url.toString();
}

function normalizeHost(host: string): string {
  return host.endsWith('/') ? host : `${host}/`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
