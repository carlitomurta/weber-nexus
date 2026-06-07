import { Controller, Get, Query } from '@nestjs/common';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';

@Controller('influxdb')
export class InfluxdbController {
  constructor(private readonly telemetryService: InfluxdbTelemetryService) {}

  @Get('readings')
  findRecentReadings(@Query('limit') limit?: string) {
    return this.telemetryService.findRecentReadings(Number(limit) || 300);
  }
}
