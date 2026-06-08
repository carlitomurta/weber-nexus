import { Controller, Get, Query } from '@nestjs/common';
import {
  InfluxdbTelemetryService,
  type InfluxReadingsRange,
} from './influxdb-telemetry.service';

@Controller('influxdb')
export class InfluxdbController {
  constructor(private readonly telemetryService: InfluxdbTelemetryService) {}

  @Get('readings')
  findRecentReadings(@Query('range') range?: string) {
    return this.telemetryService.findRecentReadings(readingsRange(range));
  }
}

function readingsRange(range?: string): InfluxReadingsRange {
  if (range === '2y' || range === '6m' || range === '1w') {
    return range;
  }

  return '6m';
}
