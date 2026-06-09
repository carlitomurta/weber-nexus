import { Injectable, type PipeTransform } from '@nestjs/common';
import type { InfluxReadingsRange } from '../influxdb-telemetry.service';

const DEFAULT_READINGS_RANGE: InfluxReadingsRange = '6m';
const READINGS_RANGES = new Set<InfluxReadingsRange>(['2y', '6m', '1w']);

@Injectable()
export class InfluxReadingsRangePipe implements PipeTransform<
  string | undefined,
  InfluxReadingsRange
> {
  transform(value?: string): InfluxReadingsRange {
    if (isInfluxReadingsRange(value)) {
      return value;
    }

    return DEFAULT_READINGS_RANGE;
  }
}

function isInfluxReadingsRange(value?: string): value is InfluxReadingsRange {
  return (
    value !== undefined && READINGS_RANGES.has(value as InfluxReadingsRange)
  );
}
