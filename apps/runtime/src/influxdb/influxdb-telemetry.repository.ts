import { Injectable } from '@nestjs/common';
import type { InfluxConfig } from '@weber-nexus/repository';
import type { InfluxSensorReading } from './influxdb-telemetry.schema';

const WRITE_TIMEOUT_MS = 3000;

@Injectable()
export class InfluxdbTelemetryRepository {
  async writeLineProtocol(
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

  async querySensorReadings(
    config: InfluxConfig,
    sql: string,
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
          q: sql,
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
