import { Controller, Get, Query } from '@nestjs/common';
import { parseInfluxReadingsQueryDto } from './dto/influx-readings-query.dto';
import { InfluxdbTelemetryService } from './influxdb-telemetry.service';

@Controller('influxdb')
export class InfluxdbController {
  constructor(private readonly telemetryService: InfluxdbTelemetryService) {}

  @Get('readings')
  findRecentReadings(@Query() query: Record<string, unknown>) {
    const dto = parseInfluxReadingsQueryDto(query);

    return this.telemetryService.findRecentReadings(
      dto.range,
      dto.controllerId,
      dto.includeHealth,
    );
  }
}
