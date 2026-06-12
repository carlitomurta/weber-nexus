import { BadRequestException } from '@nestjs/common';
import type { InfluxReadingsRange } from '../influxdb-telemetry.service';

const DEFAULT_READINGS_RANGE: InfluxReadingsRange = '6m';
const READINGS_RANGES = new Set<InfluxReadingsRange>(['2y', '1y', '6m', '1w']);

export type InfluxReadingsQueryDto = {
  readonly range: InfluxReadingsRange;
  readonly controllerId?: number;
  readonly includeHealth: boolean;
};

export function parseInfluxReadingsQueryDto(
  query: Record<string, unknown>,
): InfluxReadingsQueryDto {
  return {
    range: parseRange(query.range),
    controllerId: parseOptionalPositiveInteger(
      query.controllerId,
      'ID do controlador',
    ),
    includeHealth: parseBoolean(query.includeHealth),
  };
}

function parseRange(value: unknown): InfluxReadingsRange {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_READINGS_RANGE;
  }

  if (
    typeof value === 'string' &&
    READINGS_RANGES.has(value as InfluxReadingsRange)
  ) {
    return value as InfluxReadingsRange;
  }

  throw new BadRequestException('Intervalo de leitura inválido');
}

function parseOptionalPositiveInteger(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${label} deve ser um inteiro positivo`);
  }

  return parsed;
}

function parseBoolean(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw new BadRequestException('includeHealth deve ser verdadeiro ou falso');
}
