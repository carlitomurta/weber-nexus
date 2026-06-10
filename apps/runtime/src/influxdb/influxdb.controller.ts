import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
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
    @Query('controllerId', new ParseIntPipe({ optional: true }))
    controllerId?: number,
    @Query('includeHealth') includeHealth?: string,
  ) {
    return this.telemetryService.findRecentReadings(
      range,
      controllerId,
      includeHealth === 'true',
    );
  }
}
