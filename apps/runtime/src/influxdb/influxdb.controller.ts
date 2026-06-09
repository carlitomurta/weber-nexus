import { Controller, Get, Query } from '@nestjs/common';
import {
  InfluxdbTelemetryService,
  type InfluxReadingsRange,
} from './influxdb-telemetry.service';
import { InfluxReadingsRangePipe } from './pipes/influx-readings-range.pipe';

@Controller('influxdb')
export class InfluxdbController {
  constructor(private readonly telemetryService: InfluxdbTelemetryService) {}

  @Get('readings')
  findRecentReadings(
    @Query('range', InfluxReadingsRangePipe) range: InfluxReadingsRange,
  ) {
    return this.telemetryService.findRecentReadings(range);
  }
}
